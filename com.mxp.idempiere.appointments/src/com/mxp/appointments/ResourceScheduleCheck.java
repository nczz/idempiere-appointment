package com.mxp.appointments;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.Calendar;

import org.compiere.util.DB;

/**
 * Validates appointment time against S_ResourceType schedule settings.
 * Checks: business days (OnMonday~OnSunday) and time slot (TimeSlotStart/End).
 */
public class ResourceScheduleCheck {

	private static final String[] DAY_COLS = {
		null, "週日", "週一", "週二", "週三", "週四", "週五", "週六"
	};

	/**
	 * @return error message if schedule violated, null if OK
	 */
	public static String check(int resourceId, Timestamp dateFrom, String startTime, String endTime) {
		String sql = "SELECT r.Name, rt.IsTimeSlot, rt.TimeSlotStart, rt.TimeSlotEnd, "
				+ "rt.OnMonday, rt.OnTuesday, rt.OnWednesday, rt.OnThursday, rt.OnFriday, rt.OnSaturday, rt.OnSunday "
				+ "FROM S_Resource r JOIN S_ResourceType rt ON rt.S_ResourceType_ID = r.S_ResourceType_ID "
				+ "WHERE r.S_Resource_ID = ?";
		try (PreparedStatement ps = DB.prepareStatement(sql, null)) {
			ps.setInt(1, resourceId);
			try (ResultSet rs = ps.executeQuery()) {
				if (!rs.next()) return null;
				String resName = rs.getString(1);
				boolean isTimeSlot = "Y".equals(rs.getString(2));

				if (!isTimeSlot) return null; // No schedule restrictions

				// Check business day
				Calendar cal = Calendar.getInstance();
				cal.setTime(dateFrom);
				int dow = cal.get(Calendar.DAY_OF_WEEK); // 1=Sun, 2=Mon, ...
				// rs columns: 5=Mon, 6=Tue, 7=Wed, 8=Thu, 9=Fri, 10=Sat, 11=Sun
				int colIdx = dow == 1 ? 11 : dow + 3; // Sun→11, Mon→5, Tue→6, ...
				if ("N".equals(rs.getString(colIdx))) {
					return resName + " 在" + DAY_COLS[dow] + "不開放預約";
				}

				// Check time slot
				Timestamp slotStart = rs.getTimestamp(3);
				Timestamp slotEnd = rs.getTimestamp(4);
				if (slotStart != null && slotEnd != null) {
					String slotStartHHMM = String.format("%02d:%02d", slotStart.getHours(), slotStart.getMinutes());
					String slotEndHHMM = String.format("%02d:%02d", slotEnd.getHours(), slotEnd.getMinutes());
					if (startTime.compareTo(slotStartHHMM) < 0 || endTime.compareTo(slotEndHHMM) > 0) {
						return resName + " 的營業時段為 " + slotStartHHMM + "~" + slotEndHHMM;
					}
				}
			}
		} catch (Exception e) {
			// ignore — don't block booking on check failure
		}
		return null;
	}
}
