package com.mxp.appointments;

import javax.servlet.http.HttpServletRequest;

/** Extracts AD_Client_ID and AD_Org_ID set by AuthFilter. */
public class AuthContext {
	public static int getClientId(HttpServletRequest req) {
		Object v = req.getAttribute("AD_Client_ID");
		return v instanceof Integer ? (Integer) v : -1;
	}
	public static int getOrgId(HttpServletRequest req) {
		Object v = req.getAttribute("AD_Org_ID");
		return v instanceof Integer ? (Integer) v : 0;
	}
}
