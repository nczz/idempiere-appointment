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
 * GET /appointment/init
 * Returns resourceTypes, resources, and statusList in a single call.
 * Replaces 4 separate REST API calls on SPA init.
 */
public class InitServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		int clientId = AuthContext.getClientId(req);

		try {
			StringBuilder json = new StringBuilder("{");

			// 1. Resource Types (only time-based types for appointment scheduling)
			json.append("\"resourceTypes\":[");
			String sql = "SELECT S_ResourceType_ID, Name, IsTimeSlot, TimeSlotStart, TimeSlotEnd, "
					+ "IsSingleAssignment, OnMonday, OnTuesday, OnWednesday, OnThursday, OnFriday, OnSaturday, OnSunday "
					+ "FROM S_ResourceType WHERE IsActive='Y' AND IsTimeSlot='Y' AND AD_Client_ID IN (0, " + clientId + ") ORDER BY Name";
			appendRows(json, sql, rs -> {
				return "{\"id\":" + rs.getInt(1)
						+ ",\"Name\":\"" + esc(rs.getString(2)) + "\""
						+ ",\"IsTimeSlot\":" + "Y".equals(rs.getString(3))
						+ ",\"TimeSlotStart\":\"" + nvl(rs.getString(4)) + "\""
						+ ",\"TimeSlotEnd\":\"" + nvl(rs.getString(5)) + "\""
						+ ",\"IsSingleAssignment\":" + "Y".equals(rs.getString(6))
						+ ",\"OnMonday\":" + "Y".equals(rs.getString(7))
						+ ",\"OnTuesday\":" + "Y".equals(rs.getString(8))
						+ ",\"OnWednesday\":" + "Y".equals(rs.getString(9))
						+ ",\"OnThursday\":" + "Y".equals(rs.getString(10))
						+ ",\"OnFriday\":" + "Y".equals(rs.getString(11))
						+ ",\"OnSaturday\":" + "Y".equals(rs.getString(12))
						+ ",\"OnSunday\":" + "Y".equals(rs.getString(13))
						+ "}";
			});
			json.append("],");

			// 2. Resources (only available resources under time-based types)
			json.append("\"resources\":[");
			sql = "SELECT r.S_Resource_ID, r.Name, r.S_ResourceType_ID, r.IsAvailable, r.X_Color "
					+ "FROM S_Resource r JOIN S_ResourceType rt ON rt.S_ResourceType_ID = r.S_ResourceType_ID "
					+ "WHERE r.IsActive='Y' AND r.IsAvailable='Y' AND rt.IsTimeSlot='Y' "
					+ "AND r.AD_Client_ID IN (0, " + clientId + ") ORDER BY r.Name";
			appendRows(json, sql, rs -> {
				String color = rs.getString(5);
				return "{\"id\":" + rs.getInt(1)
						+ ",\"Name\":\"" + esc(rs.getString(2)) + "\""
						+ ",\"S_ResourceType_ID\":" + rs.getInt(3)
						+ ",\"IsAvailable\":" + "Y".equals(rs.getString(4))
						+ (color != null && color.startsWith("#") ? ",\"_color\":\"" + esc(color) + "\"" : "")
						+ "}";
			});
			json.append("],");

			// 3. Status List
			json.append("\"statusList\":[");
			sql = "SELECT rl.Value, rl.Name, rl.Description "
					+ "FROM AD_Ref_List rl "
					+ "JOIN AD_Reference r ON r.AD_Reference_ID = rl.AD_Reference_ID "
					+ "WHERE r.Name = 'X_AppointmentStatus' AND rl.IsActive='Y' "
					+ "ORDER BY rl.Value";
			appendRows(json, sql, rs -> {
				return "{\"Value\":\"" + esc(rs.getString(1)) + "\""
						+ ",\"Name\":\"" + esc(rs.getString(2)) + "\""
						+ ",\"Description\":\"" + esc(rs.getString(3)) + "\""
						+ "}";
			});
			json.append("],");

			// 4. Service List (from X_AppointmentService reference)
			json.append("\"serviceList\":[");
			sql = "SELECT rl.Value, rl.Name, rl.Description "
					+ "FROM AD_Ref_List rl "
					+ "JOIN AD_Reference r ON r.AD_Reference_ID = rl.AD_Reference_ID "
					+ "WHERE r.Name = 'X_AppointmentService' AND rl.IsActive='Y' "
					+ "ORDER BY rl.Name";
			appendRows(json, sql, rs -> {
				return "{\"Value\":\"" + esc(rs.getString(1)) + "\""
						+ ",\"Name\":\"" + esc(rs.getString(2)) + "\""
						+ ",\"minutes\":" + parseInt(rs.getString(3), 30)
						+ "}";
			});
			json.append("]}");

			out.print(json);
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
		}
	}

	@FunctionalInterface
	interface RowMapper {
		String map(ResultSet rs) throws Exception;
	}

	private void appendRows(StringBuilder sb, String sql, RowMapper mapper) throws Exception {
		boolean first = true;
		try (PreparedStatement ps = DB.prepareStatement(sql, null);
			 ResultSet rs = ps.executeQuery()) {
			while (rs.next()) {
				if (!first) sb.append(",");
				sb.append(mapper.map(rs));
				first = false;
			}
		}
	}

	private String esc(String s) {
		if (s == null) return "";
		return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
	}

	private String nvl(String s) {
		return s == null ? "" : s;
	}

	private int parseInt(String s, int defaultVal) {
		if (s == null) return defaultVal;
		try { return Integer.parseInt(s.trim()); }
		catch (Exception e) { return defaultVal; }
	}
}
