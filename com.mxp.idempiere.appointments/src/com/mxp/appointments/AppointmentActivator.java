package com.mxp.appointments;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.logging.Level;

import org.adempiere.plugin.utils.Incremental2PackActivator;
import org.adempiere.webui.factory.IMappedFormFactory;
import org.compiere.model.Query;
import org.compiere.model.X_AD_Package_Imp;
import org.compiere.util.CLogger;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceReference;

public class AppointmentActivator extends Incremental2PackActivator {

	private static final CLogger log = CLogger.getCLogger(AppointmentActivator.class);
	private static final String MIGRATION_VERSION = "12.0.2";

	@Override
	public void start(BundleContext context) throws Exception {
		super.start(context);
	}

	@Override
	protected void afterPackIn() {
		// Register @Form annotated controllers
		ServiceReference<?> ref = getContext().getServiceReference(IMappedFormFactory.class.getName());
		if (ref != null) {
			IMappedFormFactory factory = (IMappedFormFactory) getContext().getService(ref);
			factory.scan(getContext(), "com.mxp.appointments");
		}

		// Run SQL migration if not yet applied
		if (!isMigrationApplied(MIGRATION_VERSION)) {
			runMigration(MIGRATION_VERSION);
		}
	}

	private boolean isMigrationApplied(String version) {
		return new Query(Env.getCtx(), X_AD_Package_Imp.Table_Name,
				"Name=? AND PK_Version=? AND PK_Status=?", null)
				.setParameters(getName(), version, "Completed successfully")
				.match();
	}

	private void runMigration(String version) {
		URL sqlUrl = getContext().getBundle().getEntry("migration/001_appointment_ad_setup.sql");
		if (sqlUrl == null) {
			log.warning("Migration SQL not found in bundle");
			return;
		}

		log.log(Level.WARNING, "Running migration " + getName() + " v" + version + " ...");
		try (InputStream is = sqlUrl.openStream();
			 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {

			StringBuilder stmt = new StringBuilder();
			String line;
			int executed = 0;
			while ((line = reader.readLine()) != null) {
				line = line.trim();
				if (line.isEmpty() || line.startsWith("--")) continue;
				if (line.toUpperCase().startsWith("SET SEARCH_PATH")) continue;
				stmt.append(line).append(" ");
				if (line.endsWith(";")) {
					String sql = stmt.toString().trim();
					sql = sql.substring(0, sql.length() - 1);
					try {
						try (var conn = DB.getConnectionRW()) {
							try (var ps = conn.createStatement()) {
								ps.execute("SET search_path TO adempiere, public");
								ps.execute(sql);
							}
							if (!conn.getAutoCommit()) conn.commit();
						}
						executed++;
					} catch (Exception e) {
						log.log(Level.WARNING, "SQL failed: " + sql.substring(0, Math.min(80, sql.length())), e);
					}
					stmt.setLength(0);
				}
			}

			// Record successful installation
			X_AD_Package_Imp imp = new X_AD_Package_Imp(Env.getCtx(), 0, null);
			imp.setName(getName());
			imp.setPK_Version(version);
			imp.setPK_Status("Completed successfully");
			imp.setProcessed(true);
			imp.saveEx();

			log.log(Level.WARNING, getName() + " v" + version + " migration completed (" + executed + " statements)");
		} catch (Exception e) {
			log.log(Level.SEVERE, "Migration failed", e);
		}
	}
}
