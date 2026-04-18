package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MSysConfig;

/**
 * JWT authentication filter for all /appointment/* endpoints (except /token).
 * Decodes and verifies the JWT, sets AD_Client_ID and AD_Org_ID as request attributes.
 */
public class AuthFilter implements Filter {

	@Override
	public void init(FilterConfig config) throws ServletException {}

	@Override
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest httpReq = (HttpServletRequest) req;
		HttpServletResponse httpResp = (HttpServletResponse) res;
		String path = httpReq.getServletPath();

		// Skip auth for /token endpoint and static files
		if ("/token".equals(path) || path.startsWith("/web/")) {
			chain.doFilter(req, res);
			return;
		}

		String auth = httpReq.getHeader("Authorization");
		if (auth == null || !auth.startsWith("Bearer ")) {
			sendError(httpResp, 401, "Missing token");
			return;
		}

		String token = auth.substring(7);
		try {
			// Verify signature
			String[] parts = token.split("\\.");
			if (parts.length != 3) throw new Exception("Invalid token format");

			String secret = MSysConfig.getValue("REST_TOKEN_SECRET", "");
			Mac mac = Mac.getInstance("HmacSHA512");
			mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
			String expectedSig = Base64.getUrlEncoder().withoutPadding()
					.encodeToString(mac.doFinal((parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8)));
			if (!expectedSig.equals(parts[2])) throw new Exception("Invalid signature");

			// Decode payload
			String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
			int clientId = extractInt(payload, "AD_Client_ID");
			int orgId = extractInt(payload, "AD_Org_ID");
			if (clientId <= 0) throw new Exception("Invalid client");

			// Check expiry
			long exp = extractLong(payload, "exp");
			if (exp > 0 && exp < System.currentTimeMillis() / 1000) throw new Exception("Token expired");

			// Set attributes for downstream servlets
			req.setAttribute("AD_Client_ID", clientId);
			req.setAttribute("AD_Org_ID", orgId);

			chain.doFilter(req, res);
		} catch (Exception e) {
			sendError(httpResp, 401, e.getMessage());
		}
	}

	@Override
	public void destroy() {}

	private void sendError(HttpServletResponse resp, int status, String msg) throws IOException {
		resp.setStatus(status);
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		out.print("{\"error\":\"" + msg.replace("\"", "'") + "\"}");
	}

	private int extractInt(String json, String key) {
		String search = "\"" + key + "\":";
		int idx = json.indexOf(search);
		if (idx < 0) return -1;
		idx += search.length();
		StringBuilder sb = new StringBuilder();
		for (int i = idx; i < json.length(); i++) {
			char c = json.charAt(i);
			if (Character.isDigit(c) || c == '-') sb.append(c);
			else if (sb.length() > 0) break;
		}
		return sb.length() > 0 ? Integer.parseInt(sb.toString()) : -1;
	}

	private long extractLong(String json, String key) {
		String search = "\"" + key + "\":";
		int idx = json.indexOf(search);
		if (idx < 0) return -1;
		idx += search.length();
		StringBuilder sb = new StringBuilder();
		for (int i = idx; i < json.length(); i++) {
			char c = json.charAt(i);
			if (Character.isDigit(c)) sb.append(c);
			else if (sb.length() > 0) break;
		}
		return sb.length() > 0 ? Long.parseLong(sb.toString()) : -1;
	}
}
