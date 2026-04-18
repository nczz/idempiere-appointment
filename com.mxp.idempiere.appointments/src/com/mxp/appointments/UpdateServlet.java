package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Timestamp;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MResourceAssignment;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.compiere.util.Trx;

/**
 * PUT /appointment/update?id=123
 * Updates an appointment. Handles group sync automatically.
 */
public class UpdateServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		int id = parseInt(req.getParameter("id"));
		if (id <= 0) { error(resp, out, 400, "Missing id"); return; }

		StringBuilder body = new StringBuilder();
		req.getReader().lines().forEach(body::append);
		String json = body.toString();

		String name = parseString(json, "name");
		String status = parseString(json, "status");
		String date = parseString(json, "date");
		String startTime = parseString(json, "startTime");
		String endTime = parseString(json, "endTime");
		String notes = parseString(json, "notes");
		String service = parseString(json, "service");

		String trxName = Trx.createTrxName("upd");
		Trx trx = Trx.get(trxName, true);

		try {
			MResourceAssignment ra = new MResourceAssignment(Env.getCtx(), id, trxName);
			if (ra.get_ID() == 0) { error(resp, out, 404, "Not found"); trx.close(); return; }
			if (ra.getAD_Client_ID() != AuthContext.getClientId(req)) { error(resp, out, 403, "Access denied"); trx.close(); return; }
			int userId = AuthContext.getUserId(req);

			// Set Env context from the record itself
			Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, ra.getAD_Client_ID());
			Env.setContext(Env.getCtx(), Env.AD_ORG_ID, ra.getAD_Org_ID());

			if (name != null) ra.setName(name);

			if (date != null && startTime != null && endTime != null) {
				Timestamp tsStart = Timestamp.valueOf(date + " " + startTime + ":00");
				Timestamp tsEnd = Timestamp.valueOf(date + " " + endTime + ":00");
				ra.setAssignDateFrom(tsStart);
				ra.setAssignDateTo(tsEnd);
			}

			// Update Description JSON
			String desc = ra.getDescription();
			if (desc == null) desc = "{}";
			try {
				if (status != null) desc = setJsonField(desc, "status", status);
				if (notes != null) desc = setJsonField(desc, "notes", notes);
				if (service != null) desc = setJsonField(desc, "service", service);
			} catch (Exception e) { /* keep original */ }
			ra.setDescription(desc);

			// Update AD columns if available
			String oldStatus = null;
			try { oldStatus = (String) ra.get_Value("X_AppointmentStatus"); } catch (Exception e) {}
			try { if (status != null) ra.set_ValueOfColumn("X_AppointmentStatus", status); } catch (Exception e) {}
			try { if (notes != null) ra.set_ValueOfColumn("X_Notes", notes); } catch (Exception e) {}
			try { if (service != null) ra.set_ValueOfColumn("X_AppointmentService", service); } catch (Exception e) {}

			ra.saveEx(trxName);

			// Write status log if status changed
			if (status != null && !status.equals(oldStatus)) {
				writeStatusLog(ra.get_ID(), oldStatus, status, ra.getAD_Client_ID(), ra.getAD_Org_ID(), userId, trxName);
			}

			// Sync grouped assignments (same time/status)
			String groupId = extractJsonField(desc, "group_id");
			if (groupId != null) {
				String sql = "SELECT S_ResourceAssignment_ID FROM S_ResourceAssignment "
						+ "WHERE Description LIKE ? AND S_ResourceAssignment_ID != ? AND IsActive='Y'";
				try (var ps = DB.prepareStatement(sql, trxName)) {
					ps.setString(1, "%" + groupId + "%");
					ps.setInt(2, id);
					try (var rs = ps.executeQuery()) {
						while (rs.next()) {
							MResourceAssignment ga = new MResourceAssignment(Env.getCtx(), rs.getInt(1), trxName);
							if (date != null && startTime != null && endTime != null) {
								ga.setAssignDateFrom(ra.getAssignDateFrom());
								ga.setAssignDateTo(ra.getAssignDateTo());
							}
							String gaDesc = ga.getDescription();
							if (gaDesc == null) gaDesc = "{}";
							try { if (status != null) gaDesc = setJsonField(gaDesc, "status", status); } catch (Exception e) {}
							ga.setDescription(gaDesc);
							try { if (status != null) ga.set_ValueOfColumn("X_AppointmentStatus", status); } catch (Exception e) {}
							ga.saveEx(trxName);
							if (status != null) {
								String gaOld = null;
								try { gaOld = extractJsonField(ga.getDescription(), "status"); } catch (Exception e) {}
								writeStatusLog(ga.get_ID(), gaOld, status, ga.getAD_Client_ID(), ga.getAD_Org_ID(), userId, trxName);
							}
						}
					}
				}
			}

			trx.commit(true);
			out.print("{\"ok\":true}");
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

	private String setJsonField(String json, String key, String value) {
		String search = "\"" + key + "\":\"";
		int idx = json.indexOf(search);
		if (idx >= 0) {
			int end = json.indexOf("\"", idx + search.length());
			return json.substring(0, idx + search.length()) + value + json.substring(end);
		}
		// Insert before closing }
		int last = json.lastIndexOf("}");
		String prefix = json.substring(0, last).trim();
		if (prefix.length() > 1) prefix += ",";
		return prefix + "\"" + key + "\":\"" + value + "\"}";
	}

	private String extractJsonField(String json, String key) {
		String search = "\"" + key + "\":\"";
		int idx = json.indexOf(search);
		if (idx < 0) return null;
		idx += search.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}

	private String parseString(String json, String field) {
		if (json == null) return null;
		String key = "\"" + field + "\":\"";
		int idx = json.indexOf(key);
		if (idx < 0) return null;
		idx += key.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}

	private int parseInt(String s) {
		if (s == null) return -1;
		try { return Integer.parseInt(s.trim()); } catch (Exception e) { return -1; }
	}

	private void writeStatusLog(int assignmentId, String oldStatus, String newStatus, int clientId, int orgId, int userId, String trxName) {
		DB.executeUpdateEx(
			"INSERT INTO X_AppointmentStatusLog (S_ResourceAssignment_ID, OldStatus, NewStatus, AD_Client_ID, AD_Org_ID, CreatedBy) "
			+ "VALUES (?, ?, ?, ?, ?, ?)",
			new Object[]{assignmentId, oldStatus, newStatus, clientId, orgId, userId}, trxName);
	}
}
