package com.mxp.appointments;

import org.adempiere.webui.panel.ADForm;
import org.adempiere.webui.panel.IFormController;
import org.compiere.util.Env;
import org.idempiere.ui.zk.annotation.Form;
import org.zkoss.zk.ui.Executions;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.util.Clients;

/**
 * Form controller for the Appointment Management SPA.
 * Generates JWT directly (same JVM) and loads SPA in iframe.
 * SPA handles desktop/mobile layout switching on its own.
 */
@Form
public class AppointmentFormController implements IFormController {

	private AppointmentForm form;

	public AppointmentFormController() {
		form = new AppointmentForm();

		int sessionId = Env.getContextAsInt(Env.getCtx(), "#AD_Session_ID");
		String language = Env.getContext(Env.getCtx(), "#AD_Language");
		String token = TokenUtil.generateToken(sessionId, language);

		if (token != null) {
			String base = Executions.getCurrent().getScheme() + "://"
					+ Executions.getCurrent().getServerName() + ":"
					+ Executions.getCurrent().getServerPort();
			String spaUrl = base + "/appointment/web/appointments/index.html#token=" + token;
			form.loadSpa(spaUrl);
			setupZoomBridge();
		} else {
			Clients.showNotification("無法取得 API Token，請確認 REST_TOKEN_SECRET 已設定",
					Clients.NOTIFICATION_TYPE_ERROR, null, null, 5000);
		}
	}

	@Override
	public ADForm getForm() {
		return form;
	}

	private void setupZoomBridge() {
		String iframeUuid = form.getIframe().getUuid();
		String script =
			"(function(){window.addEventListener('message',function(e){" +
			"if(!e.data||!e.data.type)return;" +
			"if(e.data.type==='zoom'){" +
			"var w=zk.Widget.$('#" + iframeUuid + "');" +
			"zAu.send(new zk.Event(w,'onZoom',{data:[e.data.tableName+'_ID',String(e.data.recordId)]}));" +
			"}});})();";
		Clients.evalJavaScript(script);
	}
}
