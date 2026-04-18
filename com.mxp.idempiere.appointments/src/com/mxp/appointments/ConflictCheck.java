package com.mxp.appointments;

import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.compiere.util.DB;

/**
 * Shared conflict detection logic for appointments.
 */
public class ConflictCheck {

	/**
	 * Check if a resource has a conflicting (non-cancelled) assignment in the given time range.
	 * @return conflicting assignment Name, or null if no conflict
	 */
	public static String check(int resourceId, String start, String end, int excludeId) {
		String sql = "SELECT ra.Name FROM S_ResourceAssignment ra "
				+ "JOIN S_Resource r ON r.S_Resource_ID = ra.S_Resource_ID "
				+ "JOIN S_ResourceType rt ON rt.S_ResourceType_ID = r.S_ResourceType_ID "
				+ "WHERE ra.S_Resource_ID = ? "
				+ "AND ra.AssignDateFrom < ?::timestamp AND ra.AssignDateTo > ?::timestamp "
				+ "AND ra.IsActive = 'Y' "
				+ "AND COALESCE(ra.X_AppointmentStatus, 'SCH') NOT IN ('CXL', 'ABS') "
				+ "AND ra.S_ResourceAssignment_ID != ? "
				+ "AND rt.IsSingleAssignment = 'Y' "
				+ "LIMIT 1";
		try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
			ps.setInt(1, resourceId);
			ps.setString(2, end);
			ps.setString(3, start);
			ps.setInt(4, excludeId);
			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next()) return rs.getString(1);
			}
		} catch (Exception e) {
			// ignore
		}
		return null;
	}
}
