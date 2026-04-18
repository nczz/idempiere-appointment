package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.util.DB;

/**
 * /appointment/services — CRUD for X_AppointmentService reference list.
 * GET    → list all
 * POST   → create {name, minutes}
 * PUT    → update {id, name, minutes}
 * DELETE → delete ?id=xxx
 */
public class ServiceServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	private int getRefId() {
		return DB.getSQLValue(null,
			"SELECT AD_Reference_ID FROM AD_Reference WHERE Name='X_AppointmentService'");
	}

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		int refId = getRefId();
		if (refId <= 0) { out.print("{\"services\":[]}"); return; }

		StringBuilder json = new StringBuilder("{\"services\":[");
		String sql = "SELECT AD_Ref_List_ID, Value, Name, Description FROM AD_Ref_List "
				+ "WHERE AD_Reference_ID=? AND IsActive='Y' ORDER BY Name";
		boolean first = true;
		try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
			ps.setInt(1, refId);
			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					if (!first) json.append(",");
					json.append("{\"id\":").append(rs.getInt(1));
					json.append(",\"Value\":\"").append(esc(rs.getString(2))).append("\"");
					json.append(",\"Name\":\"").append(esc(rs.getString(3))).append("\"");
					json.append(",\"minutes\":").append(parseInt(rs.getString(4), 30));
					json.append("}");
					first = false;
				}
			}
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
			return;
		}
		json.append("]}");
		out.print(json);
	}

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		String json = readBody(req);
		String name = parseStr(json, "name");
		int minutes = parseInt(parseStr(json, "minutes"), 30);
		if (name == null || name.isEmpty()) { error(resp, out, 400, "Missing name"); return; }

		int refId = getRefId();
		if (refId <= 0) { error(resp, out, 500, "Reference not found"); return; }

		String stripped = name.toUpperCase().replaceAll("[^A-Z0-9]", "");
		String value = stripped.isEmpty() ? "SVC" + System.currentTimeMillis() % 100000 : stripped.substring(0, Math.min(10, stripped.length()));
		String uuid = "mxp-appt-svc-" + System.currentTimeMillis();

		String sql = "INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, "
				+ "Created, CreatedBy, Updated, UpdatedBy, AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU) "
				+ "VALUES (nextval('ad_ref_list_sq'), 0, 0, 'Y', NOW(), ?, NOW(), ?, ?, ?, ?, ?, 'U', ?)";
		int userId = AuthContext.getUserId(req);
		try {
			DB.executeUpdateEx(sql, new Object[]{userId, userId, refId, value, name, String.valueOf(minutes), uuid}, null);
			resp.setStatus(201);
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			error(resp, out, 500, e.getMessage());
		}
	}

	@Override
	protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		String json = readBody(req);
		int id = parseInt(parseStr(json, "id"), -1);
		String name = parseStr(json, "name");
		int minutes = parseInt(parseStr(json, "minutes"), 30);
		if (id <= 0 || name == null) { error(resp, out, 400, "Missing id or name"); return; }
		int userId = AuthContext.getUserId(req);

		try {
			DB.executeUpdateEx("UPDATE AD_Ref_List SET Name=?, Description=?, Updated=NOW(), UpdatedBy=? WHERE AD_Ref_List_ID=?",
				new Object[]{name, String.valueOf(minutes), userId, id}, null);
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			error(resp, out, 500, e.getMessage());
		}
	}

	@Override
	protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		int id = parseInt(req.getParameter("id"), -1);
		if (id <= 0) { error(resp, out, 400, "Missing id"); return; }
		int userId = AuthContext.getUserId(req);

		try {
			// Soft delete: set IsActive='N' instead of deleting
			DB.executeUpdateEx("UPDATE AD_Ref_List SET IsActive='N', Updated=NOW(), UpdatedBy=? WHERE AD_Ref_List_ID=?",
				new Object[]{userId, id}, null);
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			error(resp, out, 500, e.getMessage());
		}
	}

	private void error(HttpServletResponse resp, PrintWriter out, int status, String msg) {
		resp.setStatus(status);
		out.print("{\"error\":\"" + esc(msg) + "\"}");
	}

	private String readBody(HttpServletRequest req) throws IOException {
		StringBuilder sb = new StringBuilder();
		req.getReader().lines().forEach(sb::append);
		return sb.toString();
	}

	private String parseStr(String json, String field) {
		String key = "\"" + field + "\":\"";
		int idx = json.indexOf(key);
		if (idx < 0) {
			// Try numeric
			key = "\"" + field + "\":";
			idx = json.indexOf(key);
			if (idx < 0) return null;
			idx += key.length();
			StringBuilder sb = new StringBuilder();
			for (int i = idx; i < json.length(); i++) {
				char c = json.charAt(i);
				if (Character.isDigit(c) || c == '-') sb.append(c);
				else if (sb.length() > 0) break;
			}
			return sb.toString();
		}
		idx += key.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}

	private String esc(String s) {
		if (s == null) return "";
		return s.replace("\\", "\\\\").replace("\"", "\\\"");
	}

	private int parseInt(String s, int def) {
		if (s == null) return def;
		try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
	}
}
