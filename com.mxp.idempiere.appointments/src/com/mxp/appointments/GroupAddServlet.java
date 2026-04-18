package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.UUID;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MResourceAssignment;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.compiere.util.Trx;

/**
 * POST /appointment/group-add
 * Add a resource to an existing appointment's group.
 * Request: {"assignmentId": 123, "resourceId": 456}
 * - Checks conflict for the new resource
 * - Creates group_id if not exists
 * - Creates new assignment with same time/name
 */
public class GroupAddServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		StringBuilder body = new StringBuilder();
		req.getReader().lines().forEach(body::append);
		String json = body.toString();

		int assignmentId = parseInt(json, "assignmentId");
		int resourceId = parseInt(json, "resourceId");
		if (assignmentId <= 0 || resourceId <= 0) {
			error(resp, out, 400, "Missing assignmentId or resourceId");
			return;
		}

		String trxName = Trx.createTrxName("grp");
		Trx trx = Trx.get(trxName, true);

		try {
			MResourceAssignment source = new MResourceAssignment(Env.getCtx(), assignmentId, trxName);
			if (source.get_ID() == 0) { error(resp, out, 404, "Assignment not found"); trx.close(); return; }
			if (source.getAD_Client_ID() != AuthContext.getClientId(req)) { error(resp, out, 403, "Access denied"); trx.close(); return; }

			Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, source.getAD_Client_ID());
			Env.setContext(Env.getCtx(), Env.AD_ORG_ID, source.getAD_Org_ID());
			Env.setContext(Env.getCtx(), "#AD_User_ID", AuthContext.getUserId(req));

			// Conflict check
			String startStr = source.getAssignDateFrom().toString();
			String endStr = source.getAssignDateTo().toString();
			String conflict = ConflictCheck.check(resourceId, startStr, endStr, 0);
			if (conflict != null) {
				String resName = DB.getSQLValueString(null, "SELECT Name FROM S_Resource WHERE S_Resource_ID=?", resourceId);
				error(resp, out, 409, resName + " 在此時段已有預約：" + conflict);
				trx.close();
				return;
			}

			// Ensure group_id exists
			String desc = source.getDescription();
			if (desc == null) desc = "{}";
			String groupId = extractJsonField(desc, "group_id");
			if (groupId == null) {
				groupId = UUID.randomUUID().toString();
				desc = setJsonField(desc, "group_id", groupId);
				source.setDescription(desc);
				try { source.set_ValueOfColumn("X_GroupID", groupId); } catch (Exception e) {}
				source.saveEx(trxName);
			}

			// Create new assignment for the added resource
			MResourceAssignment ra = new MResourceAssignment(Env.getCtx(), 0, trxName);
			ra.setAD_Org_ID(source.getAD_Org_ID());
			ra.setS_Resource_ID(resourceId);
			ra.setName(source.getName());
			ra.setAssignDateFrom(source.getAssignDateFrom());
			ra.setAssignDateTo(source.getAssignDateTo());
			ra.setQty(source.getQty());

			// Copy description with group_id
			String newDesc = "{\"group_id\":\"" + groupId + "\"";
			String status = extractJsonField(desc, "status");
			if (status != null) newDesc += ",\"status\":\"" + status + "\"";
			String service = extractJsonField(desc, "service");
			if (service != null) newDesc += ",\"service\":\"" + service + "\"";
			newDesc += "}";
			ra.setDescription(newDesc);

			try { ra.set_ValueOfColumn("X_AppointmentStatus", status != null ? status : "SCH"); } catch (Exception e) {}
			try { ra.set_ValueOfColumn("X_GroupID", groupId); } catch (Exception e) {}
			if (service != null) { try { ra.set_ValueOfColumn("X_AppointmentService", service); } catch (Exception e) {} }
			ra.saveEx(trxName);

			trx.commit(true);
			out.print("{\"id\":" + ra.getS_ResourceAssignment_ID() + "}");
			resp.setStatus(201);
		} catch (Exception e) {
			trx.rollback();
			error(resp, out, 500, e.getMessage());
		} finally {
			trx.close();
		}
	}

	private void error(HttpServletResponse resp, PrintWriter out, int status, String msg) {
		resp.setStatus(status);
		out.print("{\"error\":\"" + (msg != null ? msg.replace("\"", "'") : "Unknown") + "\"}");
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

	private String extractJsonField(String json, String key) {
		String search = "\"" + key + "\":\"";
		int idx = json.indexOf(search);
		if (idx < 0) return null;
		idx += search.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}

	private String setJsonField(String json, String key, String value) {
		int last = json.lastIndexOf("}");
		String prefix = json.substring(0, last).trim();
		if (prefix.length() > 1) prefix += ",";
		return prefix + "\"" + key + "\":\"" + value + "\"}";
	}
}
