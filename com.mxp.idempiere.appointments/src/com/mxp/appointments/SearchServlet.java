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
 * GET /appointment/search?q=keyword
 * Search assignments by Name (case-insensitive), filtered by client.
 * Returns top 20 results ordered by AssignDateFrom desc.
 */
public class SearchServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		String q = req.getParameter("q");
		if (q == null || q.trim().isEmpty()) {
			out.print("{\"records\":[]}");
			return;
		}

		int clientId = AuthContext.getClientId(req);

		try {
			StringBuilder json = new StringBuilder("{\"records\":[");
			String sql = "SELECT DISTINCT ra.S_ResourceAssignment_ID, ra.S_Resource_ID, ra.Name, ra.Description, "
					+ "ra.AssignDateFrom, ra.AssignDateTo, ra.IsConfirmed, ra.Qty, ra.IsActive, "
					+ "ra.X_AppointmentStatus, ra.C_BPartner_ID "
					+ "FROM S_ResourceAssignment ra "
					+ "LEFT JOIN C_BPartner bp ON bp.C_BPartner_ID = ra.C_BPartner_ID "
					+ "LEFT JOIN AD_User u ON u.C_BPartner_ID = bp.C_BPartner_ID AND u.IsActive='Y' "
					+ "WHERE ra.AD_Client_ID = ? AND ("
					+ "UPPER(ra.Name) LIKE UPPER(?) "
					+ "OR UPPER(bp.Name) LIKE UPPER(?) "
					+ "OR UPPER(bp.Value) LIKE UPPER(?) "
					+ "OR u.Phone LIKE ? "
					+ "OR UPPER(u.EMail) LIKE UPPER(?)"
					+ ") ORDER BY ra.AssignDateFrom DESC LIMIT 20";

			boolean first = true;
			String pattern = "%" + q.trim() + "%";
			try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
				ps.setInt(1, clientId);
				ps.setString(2, pattern);
				ps.setString(3, pattern);
				ps.setString(4, pattern);
				ps.setString(5, pattern);
				ps.setString(6, pattern);
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
