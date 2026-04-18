package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MResource;
import org.compiere.model.MResourceType;
import org.compiere.util.DB;
import org.compiere.util.Env;

/**
 * /appointment/resource-types — CRUD for S_ResourceType
 * /appointment/resources — CRUD for S_Resource
 *
 * Both use soft delete (IsActive='N').
 * Resource creation uses MResource model to auto-generate M_Product.
 */
public class ResourceManagementServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		String path = req.getServletPath();

		try {
			if (path.contains("resource-types")) {
				listResourceTypes(out, req);
			} else {
				listResources(out, req);
			}
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
		}
	}

	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		String json = readBody(req);
		String path = req.getServletPath();
		Env.setContext(Env.getCtx(), "#AD_User_ID", AuthContext.getUserId(req));

		try {
			if (path.contains("resource-types")) {
				createResourceType(json, resp, out);
			} else {
				createResource(json, resp, out);
			}
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + esc(e.getMessage()) + "\"}");
		}
	}

	@Override
	protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();
		String json = readBody(req);
		int id = parseInt(parseStr(json, "id"), -1);
		String name = parseStr(json, "name");
		if (id <= 0 || name == null) { error(resp, out, 400, "Missing id or name"); return; }
		int userId = AuthContext.getUserId(req);

		String table = req.getServletPath().contains("resource-types") ? "S_ResourceType" : "S_Resource";
		try {
			if (table.equals("S_Resource")) {
				String color = parseStr(json, "color");
				DB.executeUpdateEx("UPDATE S_Resource SET Name=?, X_Color=?, Updated=NOW(), UpdatedBy=? WHERE S_Resource_ID=?",
					new Object[]{name, color, userId, id}, null);
			} else {
				DB.executeUpdateEx("UPDATE S_ResourceType SET Name=?, Updated=NOW(), UpdatedBy=? WHERE S_ResourceType_ID=?",
					new Object[]{name, userId, id}, null);
			}
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

		String table = req.getServletPath().contains("resource-types") ? "S_ResourceType" : "S_Resource";
		try {
			DB.executeUpdateEx("UPDATE " + table + " SET IsActive='N', Updated=NOW(), UpdatedBy=? WHERE " + table + "_ID=?",
				new Object[]{userId, id}, null);
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			error(resp, out, 500, e.getMessage());
		}
	}

	// ── List ──

	private void listResourceTypes(PrintWriter out, HttpServletRequest req) throws Exception {
		int clientId = AuthContext.getClientId(req);
		StringBuilder json = new StringBuilder("{\"types\":[");
		String sql = "SELECT S_ResourceType_ID, Name, IsActive FROM S_ResourceType WHERE AD_Client_ID IN (0, " + clientId + ") ORDER BY Name";
		boolean first = true;
		try (PreparedStatement ps = DB.prepareStatement(sql, null); ResultSet rs = ps.executeQuery()) {
			while (rs.next()) {
				if (!first) json.append(",");
				json.append("{\"id\":").append(rs.getInt(1));
				json.append(",\"Name\":\"").append(esc(rs.getString(2))).append("\"");
				json.append(",\"IsActive\":").append("Y".equals(rs.getString(3)));
				json.append("}");
				first = false;
			}
		}
		json.append("]}");
		out.print(json);
	}

	private void listResources(PrintWriter out, HttpServletRequest req) throws Exception {
		int clientId = AuthContext.getClientId(req);
		StringBuilder json = new StringBuilder("{\"resources\":[");
		String sql = "SELECT S_Resource_ID, Name, S_ResourceType_ID, IsActive, X_Color FROM S_Resource WHERE AD_Client_ID IN (0, " + clientId + ") ORDER BY Name";
		boolean first = true;
		try (PreparedStatement ps = DB.prepareStatement(sql, null); ResultSet rs = ps.executeQuery()) {
			while (rs.next()) {
				if (!first) json.append(",");
				json.append("{\"id\":").append(rs.getInt(1));
				json.append(",\"Name\":\"").append(esc(rs.getString(2))).append("\"");
				json.append(",\"S_ResourceType_ID\":").append(rs.getInt(3));
				json.append(",\"IsActive\":").append("Y".equals(rs.getString(4)));
				String color = rs.getString(5);
				if (color != null && color.startsWith("#"))
					json.append(",\"_color\":\"").append(esc(color)).append("\"");
				json.append("}");
				first = false;
			}
		}
		json.append("]}");
		out.print(json);
	}

	// ── Create ──

	private void createResourceType(String json, HttpServletResponse resp, PrintWriter out) throws Exception {
		String name = parseStr(json, "name");
		if (name == null || name.isEmpty()) { error(resp, out, 400, "Missing name"); return; }

		int clientId = DB.getSQLValue(null, "SELECT MIN(AD_Client_ID) FROM AD_Client WHERE AD_Client_ID > 0");
		Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, clientId);
		Env.setContext(Env.getCtx(), Env.AD_ORG_ID, 0);

		MResourceType rt = new MResourceType(Env.getCtx(), 0, null);
		rt.setName(name);
		rt.setValue(name);
		rt.setIsTimeSlot(true);
		rt.setC_UOM_ID(101); // Hour
		// M_Product_Category_ID is mandatory — use client's first category
		int catId = DB.getSQLValue(null,
			"SELECT MIN(M_Product_Category_ID) FROM M_Product_Category WHERE AD_Client_ID=? AND IsActive='Y'", clientId);
		if (catId > 0) rt.setM_Product_Category_ID(catId);
		rt.setTimeSlotStart(java.sql.Timestamp.valueOf("2000-01-01 09:00:00"));
		rt.setTimeSlotEnd(java.sql.Timestamp.valueOf("2000-01-01 18:00:00"));
		rt.setOnMonday(true); rt.setOnTuesday(true); rt.setOnWednesday(true);
		rt.setOnThursday(true); rt.setOnFriday(true); rt.setOnSaturday(true);
		rt.setOnSunday(false);
		rt.saveEx();

		resp.setStatus(201);
		out.print("{\"id\":" + rt.getS_ResourceType_ID() + "}");
	}

	private void createResource(String json, HttpServletResponse resp, PrintWriter out) throws Exception {
		String name = parseStr(json, "name");
		int typeId = parseInt(parseStr(json, "resourceTypeId"), -1);
		if (name == null || name.isEmpty() || typeId <= 0) {
			error(resp, out, 400, "Missing name or resourceTypeId"); return;
		}

		int clientId = DB.getSQLValue(null, "SELECT AD_Client_ID FROM S_ResourceType WHERE S_ResourceType_ID=?", typeId);
		int orgId = DB.getSQLValue(null, "SELECT MIN(AD_Org_ID) FROM AD_Org WHERE AD_Client_ID=? AND AD_Org_ID > 0", clientId);
		int warehouseId = DB.getSQLValue(null, "SELECT MIN(M_Warehouse_ID) FROM M_Warehouse WHERE AD_Client_ID=? AND IsActive='Y'", clientId);
		Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, clientId);
		Env.setContext(Env.getCtx(), Env.AD_ORG_ID, orgId > 0 ? orgId : 0);

		MResource res = new MResource(Env.getCtx(), 0, null);
		res.setName(name);
		res.setValue(name);
		res.setS_ResourceType_ID(typeId);
		res.setIsAvailable(true);
		if (warehouseId > 0) res.setM_Warehouse_ID(warehouseId);
		res.saveEx();

		resp.setStatus(201);
		out.print("{\"id\":" + res.getS_Resource_ID() + "}");
	}

	// ── Helpers ──

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
		return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", "");
	}

	private int parseInt(String s, int def) {
		if (s == null) return def;
		try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
	}
}
