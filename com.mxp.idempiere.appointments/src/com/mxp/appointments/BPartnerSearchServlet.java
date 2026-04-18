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
 * GET /appointment/bpartners?q=keyword
 * Search C_BPartner by name. Returns id, Name, Phone, EMail.
 */
public class BPartnerSearchServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		String q = req.getParameter("q");
		if (q == null || q.trim().length() < 2) {
			out.print("{\"results\":[]}");
			return;
		}

		try {
			StringBuilder json = new StringBuilder("{\"results\":[");
			String sql = "SELECT bp.C_BPartner_ID, bp.Name, "
					+ "COALESCE(u.Phone, bp.Phone) AS Phone, "
					+ "COALESCE(u.EMail, bp.EMail) AS EMail "
					+ "FROM C_BPartner bp "
					+ "LEFT JOIN AD_User u ON u.C_BPartner_ID = bp.C_BPartner_ID AND u.IsActive='Y' "
					+ "WHERE bp.IsActive='Y' AND bp.IsCustomer='Y' "
					+ "AND LOWER(bp.Name) LIKE ? "
					+ "ORDER BY bp.Name LIMIT 10";

			boolean first = true;
			try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
				ps.setString(1, "%" + q.trim().toLowerCase() + "%");
				try (ResultSet rs = ps.executeQuery()) {
					while (rs.next()) {
						if (!first) json.append(",");
						json.append("{\"id\":").append(rs.getInt(1));
						json.append(",\"Name\":\"").append(esc(rs.getString(2))).append("\"");
						String phone = rs.getString(3);
						if (phone != null) json.append(",\"Phone\":\"").append(esc(phone)).append("\"");
						String email = rs.getString(4);
						if (email != null) json.append(",\"EMail\":\"").append(esc(email)).append("\"");
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
}
