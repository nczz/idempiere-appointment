package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MSysConfig;
import org.compiere.util.DB;

/**
 * Servlet that exchanges a valid AD_Session_ID for a JWT token.
 * Signs the token using the same HMAC-SHA512 secret as the iDempiere REST API,
 * read directly from AD_SysConfig (REST_TOKEN_SECRET).
 * No dependency on com.auth0.jwt — uses standard Java crypto.
 */
public class TokenServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		// Parse sessionId from JSON body
		StringBuilder body = new StringBuilder();
		req.getReader().lines().forEach(body::append);
		String jsonBody = body.toString();
		int sessionId = parseIntField(jsonBody, "sessionId");
		if (sessionId <= 0) {
			resp.setStatus(400);
			out.print("{\"error\":\"Missing sessionId\"}");
			return;
		}

		// Validate session and get user context
		String sql = "SELECT s.CreatedBy, s.AD_Client_ID, s.AD_Role_ID, s.AD_Org_ID, "
				+ "u.Name AS UserName, oi.M_Warehouse_ID "
				+ "FROM AD_Session s "
				+ "JOIN AD_User u ON u.AD_User_ID = s.CreatedBy "
				+ "LEFT JOIN AD_OrgInfo oi ON oi.AD_Org_ID = s.AD_Org_ID "
				+ "WHERE s.AD_Session_ID = ? AND s.IsActive = 'Y' AND s.Processed = 'N'";

		try (PreparedStatement pstmt = DB.prepareStatement(sql, null)) {
			pstmt.setInt(1, sessionId);
			try (ResultSet rs = pstmt.executeQuery()) {
				if (!rs.next()) {
					resp.setStatus(401);
					out.print("{\"error\":\"Invalid or expired session\"}");
					return;
				}

				String userName = rs.getString("UserName");
				int clientId = rs.getInt("AD_Client_ID");
				int userId = rs.getInt("CreatedBy");
				int roleId = rs.getInt("AD_Role_ID");
				int orgId = rs.getInt("AD_Org_ID");
				int warehouseId = rs.getInt("M_Warehouse_ID");

				String token = createJwt(userName, clientId, userId, roleId, orgId, warehouseId, sessionId);
				out.print("{\"token\":\"" + token + "\"}");
			}
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
		}
	}

	private String createJwt(String sub, int clientId, int userId, int roleId, int orgId, int warehouseId, int sessionId) throws Exception {
		// Header
		String header = "{\"alg\":\"HS512\",\"typ\":\"JWT\",\"kid\":\"idempiere\"}";

		// Payload — same claims as iDempiere REST auth
		long exp = (System.currentTimeMillis() / 1000) + 86400 * 7; // 7 days (outlives any ZK session)
		StringBuilder payload = new StringBuilder();
		payload.append("{\"sub\":\"").append(sub).append("\"");
		payload.append(",\"AD_Client_ID\":").append(clientId);
		payload.append(",\"AD_User_ID\":").append(userId);
		payload.append(",\"AD_Role_ID\":").append(roleId);
		payload.append(",\"AD_Org_ID\":").append(orgId);
		if (warehouseId > 0)
			payload.append(",\"M_Warehouse_ID\":").append(warehouseId);
		payload.append(",\"AD_Language\":\"zh_TW\"");
		payload.append(",\"AD_Session_ID\":").append(sessionId);
		payload.append(",\"iss\":\"idempiere.org\"");
		payload.append(",\"exp\":").append(exp);
		payload.append("}");

		// Sign
		Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
		String headerB64 = enc.encodeToString(header.getBytes(StandardCharsets.UTF_8));
		String payloadB64 = enc.encodeToString(payload.toString().getBytes(StandardCharsets.UTF_8));
		String data = headerB64 + "." + payloadB64;

		String secret = MSysConfig.getValue("REST_TOKEN_SECRET", "");
		Mac mac = Mac.getInstance("HmacSHA512");
		mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
		String sig = enc.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));

		return data + "." + sig;
	}

	private int parseIntField(String json, String field) {
		if (json == null) return -1;
		int idx = json.indexOf("\"" + field + "\"");
		if (idx < 0) return -1;
		idx = json.indexOf(":", idx) + 1;
		StringBuilder sb = new StringBuilder();
		for (int i = idx; i < json.length(); i++) {
			char c = json.charAt(i);
			if (Character.isDigit(c)) sb.append(c);
			else if (sb.length() > 0) break;
		}
		return sb.length() > 0 ? Integer.parseInt(sb.toString()) : -1;
	}
}
