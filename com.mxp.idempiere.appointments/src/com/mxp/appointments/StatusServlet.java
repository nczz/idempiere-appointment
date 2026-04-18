package com.mxp.appointments;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.util.DB;

/**
 * PUT /appointment/statuses — update status display name and color.
 * Updates system-level AD_Ref_List (client=0). Affects all tenants.
 */
public class StatusServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final int REF_ID = 1000100; // X_AppointmentStatus

	@Override
	protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		StringBuilder body = new StringBuilder();
		try (BufferedReader r = req.getReader()) {
			String line;
			while ((line = r.readLine()) != null) body.append(line);
		}
		String json = body.toString();
		String value = parseStr(json, "value");
		String name = parseStr(json, "name");
		String color = parseStr(json, "color");

		if (value == null || name == null || name.isEmpty()) {
			resp.setStatus(400);
			out.print("{\"error\":\"Missing value or name\"}");
			return;
		}

		try {
			int userId = AuthContext.getUserId(req);
			int updated = DB.executeUpdateEx(
				"UPDATE AD_Ref_List SET Name=?, Description=?, Updated=NOW(), UpdatedBy=? "
				+ "WHERE AD_Reference_ID=? AND Value=? AND AD_Client_ID=0",
				new Object[]{name, color, userId, REF_ID, value}, null);
			if (updated == 0) {
				resp.setStatus(400);
				out.print("{\"error\":\"Unknown status: " + value + "\"}");
				return;
			}
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
		}
	}

	private String parseStr(String json, String field) {
		int idx = json.indexOf("\"" + field + "\"");
		if (idx < 0) return null;
		idx = json.indexOf(":", idx) + 1;
		int q1 = json.indexOf("\"", idx);
		if (q1 < 0) return null;
		int q2 = json.indexOf("\"", q1 + 1);
		if (q2 < 0) return null;
		return json.substring(q1 + 1, q2);
	}

	private String esc(String s) {
		if (s == null) return "";
		return s.replace("\\", "\\\\").replace("\"", "\\\"");
	}
}
