package com.mxp.appointments;

import org.adempiere.webui.panel.CustomForm;
import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.Executions;
import org.zkoss.zul.Iframe;

/**
 * ZK Form that hosts the appointment SPA via an iframe.
 * <p>
 * This is a thin wrapper — all UI logic lives in the SPA (web/appointments/).
 * The form's only responsibilities are:
 * <ul>
 *   <li>Create an iframe that fills the available space</li>
 *   <li>Load the SPA from the bundle's web resources</li>
 * </ul>
 *
 * @see AppointmentFormController for token bridging and postMessage handling
 */
public class AppointmentForm extends CustomForm {

	private static final long serialVersionUID = 1L;

	private Iframe iframe;

	public AppointmentForm() {
		iframe = new Iframe();
		iframe.setId("appointmentIframe");
		iframe.setWidth("100%");
		iframe.setHeight("100%");
		iframe.setStyle("border:none;");
		appendChild(iframe);

		setWidth("100%");
		setHeight("100%");
		setStyle("position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;");
	}

	/**
	 * Set the iframe source URL with token fragment.
	 *
	 * @param token REST API JWT token
	 */
	public void loadSpa(String token) {
		String src = "appointments/index.html#token=" + token;
		ClassLoader cl = Thread.currentThread().getContextClassLoader();
		try {
			Thread.currentThread().setContextClassLoader(getClass().getClassLoader());
			iframe.setSrc(src);
		} finally {
			Thread.currentThread().setContextClassLoader(cl);
		}
	}

	public Iframe getIframe() {
		return iframe;
	}
}
