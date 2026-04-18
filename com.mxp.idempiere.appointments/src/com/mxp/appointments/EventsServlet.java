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
 * GET /appointment/events?start=2026-04-14&end=2026-04-21
 * Returns all assignments across all resources for the date range.
 * Replaces N separate REST API calls (one per resource).
 */
public class EventsServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		String start = req.getParameter("start");
		String end = req.getParameter("end");
		if (start == null || end == null) {
			resp.setStatus(400);
			out.print("{\"error\":\"Missing start/end parameters\"}");
			return;
		}

		int clientId = AuthContext.getClientId(req);

		try {
			StringBuilder json = new StringBuilder("{\"events\":[");
			String sql = "SELECT S_ResourceAssignment_ID, S_Resource_ID, Name, Description, "
					+ "AssignDateFrom, AssignDateTo, IsConfirmed, Qty, IsActive, "
					+ "X_AppointmentStatus, C_BPartner_ID "
					+ "FROM S_ResourceAssignment "
					+ "WHERE AssignDateFrom >= ?::date AND AssignDateFrom < ?::date "
					+ "AND IsActive='Y' AND AD_Client_ID = ? "
					+ "ORDER BY AssignDateFrom";

			boolean first = true;
			try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
				ps.setString(1, start);
				ps.setString(2, end);
				ps.setInt(3, clientId);
				try (ResultSet rs = ps.executeQuery()) {
					while (rs.next()) {
						if (!first) json.append(",");
						json.append("{\"id\":").append(rs.getInt(1));
						json.append(",\"S_Resource_ID\":").append(rs.getInt(2));
						json.append(",\"Name\":\"").append(esc(rs.getString(3))).append("\"");
						json.append(",\"Description\":\"").append(esc(rs.getString(4))).append("\"");
						json.append(",\"AssignDateFrom\":\"").append(nvl(rs.getString(5))).append("\"");
						json.append(",\"AssignDateTo\":\"").append(nvl(rs.getString(6))).append("\"");
						json.append(",\"IsConfirmed\":").append("Y".equals(rs.getString(7)));
						json.append(",\"Qty\":").append(rs.getBigDecimal(8));
						json.append(",\"X_AppointmentStatus\":\"").append(nvl(rs.getString(10))).append("\"");
						int bpId = rs.getInt(11);
						if (!rs.wasNull()) json.append(",\"C_BPartner_ID\":").append(bpId);
						json.append("}");
						first = false;
					}
				}
			}
			json.append("]}");
			out.print(json);
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
		}
	}

	private String esc(String s) {
		if (s == null) return "";
		return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
	}

	private String nvl(String s) {
		return s == null ? "" : s;
	}
}
