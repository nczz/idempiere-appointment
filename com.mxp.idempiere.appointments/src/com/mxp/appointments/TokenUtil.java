package com.mxp.appointments;

import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.compiere.model.MSysConfig;
import org.compiere.util.DB;

/**
 * Generates JWT tokens for the Appointment SPA.
 * Called directly from FormController (same JVM) — no HTTP needed.
 */
public class TokenUtil {

	/**
	 * Generate a JWT token for the given AD_Session_ID.
	 * @return JWT string, or null if session is invalid
	 */
	public static String generateToken(int sessionId, String language) {
		if (sessionId <= 0) return null;
		if (language == null || language.isEmpty()) language = "en_US";

		String sql = "SELECT s.CreatedBy, s.AD_Client_ID, s.AD_Role_ID, s.AD_Org_ID, "
				+ "u.Name AS UserName, COALESCE(oi.M_Warehouse_ID,0) AS M_Warehouse_ID "
				+ "FROM AD_Session s "
				+ "JOIN AD_User u ON u.AD_User_ID = s.CreatedBy "
				+ "LEFT JOIN AD_OrgInfo oi ON oi.AD_Org_ID = s.AD_Org_ID "
				+ "WHERE s.AD_Session_ID = ? AND s.IsActive = 'Y' AND s.Processed = 'N'";

		try (PreparedStatement pstmt = DB.prepareStatement(sql, null)) {
			pstmt.setInt(1, sessionId);
			try (ResultSet rs = pstmt.executeQuery()) {
				if (!rs.next()) return null;

				String userName = rs.getString("UserName");
				int clientId = rs.getInt("AD_Client_ID");
				int userId = rs.getInt("CreatedBy");
				int roleId = rs.getInt("AD_Role_ID");
				int orgId = rs.getInt("AD_Org_ID");
				int warehouseId = rs.getInt("M_Warehouse_ID");

				return createJwt(userName, clientId, userId, roleId, orgId, warehouseId, sessionId, language);
			}
		} catch (Exception e) {
			return null;
		}
	}

	static String createJwt(String sub, int clientId, int userId, int roleId, int orgId, int warehouseId, int sessionId, String language) throws Exception {
		String header = "{\"alg\":\"HS512\",\"typ\":\"JWT\",\"kid\":\"idempiere\"}";

		long exp = (System.currentTimeMillis() / 1000) + 86400 * 7;
		StringBuilder payload = new StringBuilder();
		payload.append("{\"sub\":\"").append(sub).append("\"");
		payload.append(",\"AD_Client_ID\":").append(clientId);
		payload.append(",\"AD_User_ID\":").append(userId);
		payload.append(",\"AD_Role_ID\":").append(roleId);
		payload.append(",\"AD_Org_ID\":").append(orgId);
		if (warehouseId > 0)
			payload.append(",\"M_Warehouse_ID\":").append(warehouseId);
		payload.append(",\"AD_Language\":\"").append(language).append("\"");
		payload.append(",\"AD_Session_ID\":").append(sessionId);
		payload.append(",\"iss\":\"idempiere.org\"");
		payload.append(",\"exp\":").append(exp);
		payload.append("}");

		Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
		String headerB64 = enc.encodeToString(header.getBytes(StandardCharsets.UTF_8));
		String payloadB64 = enc.encodeToString(payload.toString().getBytes(StandardCharsets.UTF_8));
		String data = headerB64 + "." + payloadB64;

		String secret = MSysConfig.getValue("REST_TOKEN_SECRET", "");
		if (secret.isEmpty()) throw new IllegalStateException("REST_TOKEN_SECRET not configured");

		Mac mac = Mac.getInstance("HmacSHA512");
		mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
		String sig = enc.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));

		return data + "." + sig;
	}
}
