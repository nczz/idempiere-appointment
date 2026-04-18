package com.mxp.appointments;

import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.compiere.model.MResourceAssignment;
import org.compiere.util.DB;
import org.compiere.util.Env;

/**
 * DELETE /appointment/group-remove?id=123
 * Remove a resource from an appointment group (deletes the assignment).
 * Prevents removing the last resource in a group.
 */
public class GroupRemoveServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("application/json; charset=UTF-8");
		PrintWriter out = resp.getWriter();

		int id = 0;
		try { id = Integer.parseInt(req.getParameter("id")); } catch (Exception e) {}
		if (id <= 0) { resp.setStatus(400); out.print("{\"error\":\"Missing id\"}"); return; }

		MResourceAssignment ra = new MResourceAssignment(Env.getCtx(), id, null);
		if (ra.get_ID() == 0) { resp.setStatus(404); out.print("{\"error\":\"Not found\"}"); return; }
		if (ra.getAD_Client_ID() != AuthContext.getClientId(req)) { resp.setStatus(403); out.print("{\"error\":\"Access denied\"}"); return; }

		Env.setContext(Env.getCtx(), Env.AD_CLIENT_ID, ra.getAD_Client_ID());
		Env.setContext(Env.getCtx(), Env.AD_ORG_ID, ra.getAD_Org_ID());
		Env.setContext(Env.getCtx(), "#AD_User_ID", AuthContext.getUserId(req));

		// Check: if this is the only assignment (no group or last in group), block removal
		String desc = ra.getDescription();
		if (desc != null && desc.contains("group_id")) {
			String groupId = extractField(desc, "group_id");
			if (groupId != null) {
				int count = DB.getSQLValue(null,
					"SELECT COUNT(*) FROM S_ResourceAssignment WHERE Description LIKE ? AND IsActive='Y'",
					"%" + groupId + "%");
				if (count <= 1) {
					resp.setStatus(400);
					out.print("{\"error\":\"無法移除最後一個資源\"}");
					return;
				}
			}
		} else {
			resp.setStatus(400);
			out.print("{\"error\":\"此預約只有一個資源，無法移除\"}");
			return;
		}

		try {
			ra.deleteEx(true);
			out.print("{\"ok\":true}");
		} catch (Exception e) {
			resp.setStatus(500);
			out.print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
		}
	}

	private String extractField(String json, String key) {
		String search = "\"" + key + "\":\"";
		int idx = json.indexOf(search);
		if (idx < 0) return null;
		idx += search.length();
		int end = json.indexOf("\"", idx);
		return end > idx ? json.substring(idx, end) : null;
	}
}
