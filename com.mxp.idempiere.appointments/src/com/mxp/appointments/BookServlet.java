package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MResourceAssignment;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.compiere.util.Trx;

/**
 * POST /appointment/book
 * Creates appointment(s) atomically. Handles multi-resource group booking.
 *
 * Request: {"name","resourceIds":[id,...],"date","startTime","endTime","service","notes","bpartnerId"}
 * Response: {"ids":[id,...]} or {"error":"..."}
 */
public class BookServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		StringBuilder body = new StringBuilder();
		req.getReader().lines().forEach(body::append);
		String json = body.toString();

		String name = parseString(json, "name");
		String date = parseString(json, "date");
		String startTime = parseString(json, "startTime");
		String endTime = parseString(json, "endTime");
		String service = parseString(json, "service");
		String notes = parseString(json, "notes");
		int bpartnerId = parseInt(json, "bpartnerId");
		int[] resourceIds = parseIntArray(json, "resourceIds");

		if (name == null || name.isEmpty()) { error(resp, out, 400, "Missing name"); return; }
		if (resourceIds.length == 0) { error(resp, out, 400, "Missing resourceIds"); return; }
		if (date == null || startTime == null || endTime == null) { error(resp, out, 400, "Missing date/time"); return; }

		// Get client from the resource (WAB servlet has no ZK session context)
		int clientId = DB.getSQLValue(null, "SELECT AD_Client_ID FROM S_Resource WHERE S_Resource_ID=?", resourceIds[0]);
		if (clientId <= 0) { error(resp, out, 400, "Invalid resource"); return; }

		// Verify resource belongs to the same tenant
		int tokenClientId = AuthContext.getClientId(req);
		if (clientId != tokenClientId) { error(resp, out, 403, "Access denied"); return; }

		// Org: use resource's org if specific, otherwise use token's org (user's login org)
		int resOrgId = DB.getSQLValue(null, "SELECT AD_Org_ID FROM S_Resource WHERE S_Resource_ID=?", resourceIds[0]);
		int orgId = resOrgId > 0 ? resOrgId : AuthContext.getOrgId(req);
		// If still 0, pick the first non-zero org for this client
		if (orgId <= 0) {
			orgId = DB.getSQLValue(null,
				"SELECT AD_Org_ID FROM AD_Org WHERE AD_Client_ID=? AND AD_Org_ID>0 AND IsActive='Y' ORDER BY AD_Org_ID LIMIT 1",
				clientId);
		}
		if (orgId <= 0) { error(resp, out, 400, "No organization available"); return; }

		// Set up minimal Env context for MResourceAssignment
		Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, clientId);
		Env.setContext(Env.getCtx(), Env.AD_ORG_ID, orgId);
		Env.setContext(Env.getCtx(), "#AD_User_ID", AuthContext.getUserId(req));

		String startISO = date + " " + startTime + ":00";
		String endISO = date + " " + endTime + ":00";
		Timestamp tsStart = Timestamp.valueOf(startISO);
		Timestamp tsEnd = Timestamp.valueOf(endISO);

		// Conflict check
		for (int rid : resourceIds) {
			String conflict = ConflictCheck.check(rid, startISO, endISO, 0);
			if (conflict != null) {
				String resName = DB.getSQLValueString(null, "SELECT Name FROM S_Resource WHERE S_Resource_ID=?", rid);
				error(resp, out, 409, resName + " 在此時段已有預約：" + conflict);
				return;
			}
		}

		String displayName = name + (service != null && !service.isEmpty() ? " - " + service : "");
		String groupId = resourceIds.length > 1 ? UUID.randomUUID().toString() : null;

		String trxName = Trx.createTrxName("book");
		Trx trx = Trx.get(trxName, true);
		List<Integer> createdIds = new ArrayList<>();

		try {
			for (int rid : resourceIds) {
				MResourceAssignment ra = new MResourceAssignment(Env.getCtx(), 0, trxName);
				ra.setAD_Org_ID(orgId);
				ra.setS_Resource_ID(rid);
				ra.setName(displayName);
				ra.setAssignDateFrom(tsStart);
				ra.setAssignDateTo(tsEnd);
				ra.setQty(java.math.BigDecimal.ONE);

				// Description JSON
				StringBuilder desc = new StringBuilder("{");
				desc.append("\"status\":\"SCH\"");
				if (service != null && !service.isEmpty())
					desc.append(",\"service\":\"").append(service.replace("\"", "\\\"")).append("\"");
				if (notes != null && !notes.isEmpty())
					desc.append(",\"notes\":\"").append(notes.replace("\"", "\\\"")).append("\"");
				if (groupId != null)
					desc.append(",\"group_id\":\"").append(groupId).append("\"");
				if (bpartnerId > 0)
					desc.append(",\"bpartner_id\":").append(bpartnerId);
				desc.append("}");
				ra.setDescription(desc.toString());

				// Set custom columns if they exist
				try { ra.set_ValueOfColumn("X_AppointmentStatus", "SCH"); } catch (Exception e) {}
				try { if (bpartnerId > 0) ra.set_ValueOfColumn("C_BPartner_ID", bpartnerId); } catch (Exception e) {}
				try { if (service != null && !service.isEmpty()) ra.set_ValueOfColumn("X_AppointmentService", service); } catch (Exception e) {}
				try { if (groupId != null) ra.set_ValueOfColumn("X_GroupID", groupId); } catch (Exception e) {}
				try { if (notes != null && !notes.isEmpty()) ra.set_ValueOfColumn("X_Notes", notes); } catch (Exception e) {}

				ra.saveEx(trxName);
				createdIds.add(ra.getS_ResourceAssignment_ID());
			}
			trx.commit(true);

			StringBuilder result = new StringBuilder("{\"ids\":[");
			for (int i = 0; i < createdIds.size(); i++) {
				if (i > 0) result.append(",");
				result.append(createdIds.get(i));
			}
			result.append("]}");
			resp.setStatus(201);
			out.print(result);
		} catch (Exception e) {
			trx.rollback();
			// Clean up any partially created records
			error(resp, out, 500, e.getMessage());
		} finally {
			trx.close();
		}
	}

	private void error(HttpServletResponse resp, PrintWriter out, int status, String msg) {
		resp.setStatus(status);
		out.print("{\"error\":\"" + (msg != null ? msg.replace("\"", "'") : "Unknown error") + "\"}");
	}

	private String parseString(String json, String field) {
		String key = "\"" + field + "\":\"";
		int idx = json.indexOf(key);
		if (idx < 0) return null;
		idx += key.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}

	private int parseInt(String json, String field) {
		String key = "\"" + field + "\":";
		int idx = json.indexOf(key);
		if (idx < 0) return -1;
		idx += key.length();
		StringBuilder sb = new StringBuilder();
		for (int i = idx; i < json.length(); i++) {
			char c = json.charAt(i);
			if (Character.isDigit(c)) sb.append(c);
			else if (sb.length() > 0) break;
		}
		return sb.length() > 0 ? Integer.parseInt(sb.toString()) : -1;
	}

	private int[] parseIntArray(String json, String field) {
		String key = "\"" + field + "\":[";
		int idx = json.indexOf(key);
		if (idx < 0) return new int[0];
		idx += key.length();
		int end = json.indexOf("]", idx);
		if (end < 0) return new int[0];
		String arr = json.substring(idx, end).trim();
		if (arr.isEmpty()) return new int[0];
		String[] parts = arr.split(",");
		int[] result = new int[parts.length];
		for (int i = 0; i < parts.length; i++)
			result[i] = Integer.parseInt(parts[i].trim());
		return result;
	}
}
