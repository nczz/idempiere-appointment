package com.mxp.appointments;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.logging.Level;

import org.adempiere.webui.panel.ADForm;
import org.adempiere.webui.panel.IFormController;
import org.compiere.util.CLogger;
import org.compiere.util.Env;
import org.idempiere.ui.zk.annotation.Form;
import org.zkoss.zk.ui.Execution;
import org.zkoss.zk.ui.Executions;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.util.Clients;

/**
 * Form controller for the Appointment Management SPA.
 * Uses the current ZK session's AD_Session_ID to obtain a REST JWT token
 * via the custom /api/v1/appointment/token endpoint — no service account needed.
 */
@Form
public class AppointmentFormController implements IFormController {

	private static final CLogger log = CLogger.getCLogger(AppointmentFormController.class);
	private AppointmentForm form;

	public AppointmentFormController() {
		form = new AppointmentForm();
		String token = requestToken();
		if (token != null) {
			// Build full URL here — Controller constructor runs in ZK execution context
			String base = Executions.getCurrent().getScheme() + "://"
					+ Executions.getCurrent().getServerName() + ":"
					+ Executions.getCurrent().getServerPort();
			form.loadSpa(base + "/appointment/web/appointments/index.html#token=" + token);
			setupTokenRefreshBridge();
		} else {
			Clients.showNotification("無法取得 API Token，請重新整理頁面",
					Clients.NOTIFICATION_TYPE_ERROR, null, null, 5000);
		}
	}

	@Override
	public ADForm getForm() {
		return form;
	}

	/**
	 * Call our custom REST endpoint to exchange the current AD_Session_ID for a JWT token.
	 */
	private String requestToken() {
		try {
			int sessionId = Env.getContextAsInt(Env.getCtx(), "#AD_Session_ID");
			if (sessionId <= 0) {
				log.warning("No AD_Session_ID in context");
				return null;
			}
			String json = "{\"sessionId\":" + sessionId + "}";
			Execution exec = Executions.getCurrent();
			String scheme = exec.getScheme();
			String host = exec.getServerName();
			int port = exec.getServerPort();
			String portStr = (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) ? "" : ":" + port;
			String tokenUrl = scheme + "://" + host + portStr + "/appointment/token";
			String response = httpPost(tokenUrl, json);
			return extractJsonValue(response, "token");
		} catch (Exception e) {
			log.log(Level.SEVERE, "Token request failed", e);
			return null;
		}
	}

	private void setupTokenRefreshBridge() {
		String iframeUuid = form.getIframe().getUuid();
		// Zoom uses ZK's built-in ZoomCommand: onZoom with {data: [columnName, recordId]}
		String script =
			"(function(){window.addEventListener('message',function(e){" +
			"if(!e.data||!e.data.type)return;" +
			"var w=zk.Widget.$('#" + iframeUuid + "');" +
			"if(e.data.type==='refresh-token'){" +
			"zAu.send(new zk.Event(w,'onTokenRefresh',null));" +
			"}else if(e.data.type==='zoom'){" +
			"zAu.send(new zk.Event(w,'onZoom',{data:[e.data.tableName+'_ID',String(e.data.recordId)]}));" +
			"}});})();";
		Clients.evalJavaScript(script);

		form.getIframe().addEventListener("onTokenRefresh", new EventListener<Event>() {
			@Override
			public void onEvent(Event event) {
				String newToken = requestToken();
				if (newToken != null) {
					Clients.evalJavaScript(String.format(
						"var f=document.getElementById('%s');" +
						"if(f&&f.contentWindow)f.contentWindow.postMessage({type:'token-refreshed',token:'%s'},'*');",
						form.getIframe().getUuid(), newToken));
				}
			}
		});
	}

	private String httpPost(String urlStr, String jsonBody) throws Exception {
		URL url = new URL(urlStr);
		HttpURLConnection conn = (HttpURLConnection) url.openConnection();
		conn.setRequestMethod("POST");
		conn.setRequestProperty("Content-Type", "application/json");
		conn.setConnectTimeout(5000);
		conn.setReadTimeout(5000);
		conn.setDoOutput(true);
		try (OutputStream os = conn.getOutputStream()) {
			os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
		}
		try (BufferedReader br = new BufferedReader(
				new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
			StringBuilder sb = new StringBuilder();
			String line;
			while ((line = br.readLine()) != null) sb.append(line);
			return sb.toString();
		}
	}

	private String extractJsonValue(String json, String key) {
		if (json == null) return null;
		String search = "\"" + key + "\":\"";
		int start = json.indexOf(search);
		if (start < 0) return null;
		start += search.length();
		int end = json.indexOf("\"", start);
		return end > start ? json.substring(start, end) : null;
	}
}
