-- =============================================================================
-- iDempiere Appointment Management: AD Configuration Migration
-- =============================================================================

SET search_path TO adempiere, public;

-- 0. AD_Element for X_AppointmentStatus
INSERT INTO AD_Element (AD_Element_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  ColumnName, Name, PrintName, Description, EntityType, AD_Element_UU)
SELECT 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  'X_AppointmentStatus', 'Appointment Status', 'Appointment Status',
  'Appointment lifecycle status', 'U', 'mxp-appt-elem-status'
WHERE NOT EXISTS (SELECT 1 FROM AD_Element WHERE AD_Element_UU = 'mxp-appt-elem-status');

-- 1. Reference: X_AppointmentStatus (ID=1000100)
INSERT INTO AD_Reference (AD_Reference_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, ValidationType, EntityType, AD_Reference_UU)
SELECT 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  'X_AppointmentStatus', 'Appointment scheduling status', 'L', 'U',
  'mxp-appt-ref-status-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_Reference WHERE AD_Reference_UU = 'mxp-appt-ref-status-001');

-- 2. Reference List entries
INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'SCH', '預約中', '#FBBF24', 'U', 'mxp-appt-reflist-sch'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-sch');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000101, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'CFM', '已確認', '#3B82F6', 'U', 'mxp-appt-reflist-cfm'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-cfm');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000102, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'CHK', '已報到', '#10B981', 'U', 'mxp-appt-reflist-chk'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-chk');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000103, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'INP', '看診中', '#F97316', 'U', 'mxp-appt-reflist-inp'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-inp');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000104, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'DON', '已完成', '#9CA3AF', 'U', 'mxp-appt-reflist-don'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-don');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000105, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'ABS', '爽約', '#EF4444', 'U', 'mxp-appt-reflist-abs'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-abs');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000106, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000100, 'CXL', '取消', '#D1D5DB', 'U', 'mxp-appt-reflist-cxl'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-reflist-cxl');

-- 3. Column: X_AppointmentStatus on S_ResourceAssignment (AD_Table_ID=485)
INSERT INTO AD_Column (AD_Column_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Table_ID, AD_Element_ID, ColumnName, Name, Description,
  AD_Reference_ID, AD_Reference_Value_ID,
  FieldLength, DefaultValue, IsMandatory, IsUpdateable, IsAlwaysUpdateable,
  IsToolbarButton, IsAllowLogging, IsAllowCopy, IsSecure, IsHtml, IsAutocomplete, IsPartitionKey,
  EntityType, AD_Column_UU, Version, IsKey, IsParent, IsTranslated, IsIdentifier, IsSelectionColumn)
SELECT 1000200, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  485, 1000100, 'X_AppointmentStatus', 'Appointment Status', 'Appointment lifecycle status',
  17, 1000100,
  3, 'SCH', 'N', 'Y', 'Y',
  'N', 'Y', 'Y', 'N', 'N', 'N', 'N',
  'U', 'mxp-appt-col-status', 0, 'N', 'N', 'N', 'N', 'N'
WHERE NOT EXISTS (SELECT 1 FROM AD_Column WHERE AD_Column_UU = 'mxp-appt-col-status');

-- 4. Column: C_BPartner_ID on S_ResourceAssignment (Table Direct=19, AD_Element_ID=187)
INSERT INTO AD_Column (AD_Column_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Table_ID, AD_Element_ID, ColumnName, Name, Description,
  AD_Reference_ID,
  FieldLength, IsMandatory, IsUpdateable, IsAlwaysUpdateable,
  IsToolbarButton, IsAllowLogging, IsAllowCopy, IsSecure, IsHtml, IsAutocomplete, IsPartitionKey,
  EntityType, AD_Column_UU, Version, IsKey, IsParent, IsTranslated, IsIdentifier, IsSelectionColumn)
SELECT 1000201, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  485, 187, 'C_BPartner_ID', 'Business Partner', 'Patient linked to this appointment',
  19,
  10, 'N', 'Y', 'Y',
  'N', 'Y', 'Y', 'N', 'N', 'N', 'N',
  'U', 'mxp-appt-col-bpartner', 0, 'N', 'N', 'N', 'N', 'N'
WHERE NOT EXISTS (SELECT 1 FROM AD_Column WHERE AD_Column_UU = 'mxp-appt-col-bpartner');

-- 4b. AD_Element for X_Color
INSERT INTO AD_Element (AD_Element_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  ColumnName, Name, PrintName, Description, EntityType, AD_Element_UU)
SELECT 1000101, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  'X_Color', 'Color', 'Color', 'Hex color code', 'U', 'mxp-appt-elem-color'
WHERE NOT EXISTS (SELECT 1 FROM AD_Element WHERE AD_Element_UU = 'mxp-appt-elem-color');

-- 4c. AD_Column: X_Color on S_Resource (AD_Table_ID=487, String type=10)
INSERT INTO AD_Column (AD_Column_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Table_ID, AD_Element_ID, ColumnName, Name, Description,
  AD_Reference_ID,
  FieldLength, IsMandatory, IsUpdateable, IsAlwaysUpdateable,
  IsToolbarButton, IsAllowLogging, IsAllowCopy, IsSecure, IsHtml, IsAutocomplete, IsPartitionKey,
  EntityType, AD_Column_UU, Version, IsKey, IsParent, IsTranslated, IsIdentifier, IsSelectionColumn)
SELECT 1000202, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  487, 1000101, 'X_Color', 'Color', 'Hex color code for calendar display',
  10,
  7, 'N', 'Y', 'Y',
  'N', 'Y', 'Y', 'N', 'N', 'N', 'N',
  'U', 'mxp-appt-col-color', 0, 'N', 'N', 'N', 'N', 'N'
WHERE NOT EXISTS (SELECT 1 FROM AD_Column WHERE AD_Column_UU = 'mxp-appt-col-color');

-- 5. DB columns — created by Java syncColumns() after AD_Column INSERT
-- (Do NOT use ALTER TABLE here — iDempiere's DB.executeUpdateEx doesn't handle DDL properly.
--  The Activator's afterPackIn() calls syncColumns() to create actual DB columns.)

-- 6. AD_Form: 預約管理
INSERT INTO AD_Form (AD_Form_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, Classname, IsBetaFunctionality, AccessLevel, EntityType, AD_Form_UU)
SELECT 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  '預約管理', 'Appointment Management Calendar', 'com.mxp.appointments.AppointmentFormController',
  'N', '3', 'U', 'mxp-appt-form-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_Form WHERE AD_Form_UU = 'mxp-appt-form-001');

-- 7. AD_Menu: 預約管理 (Action=X means Form)
INSERT INTO AD_Menu (AD_Menu_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, IsSummary, IsSOTrx, IsReadOnly, Action, AD_Form_ID, EntityType, AD_Menu_UU)
SELECT 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  '預約管理', 'Appointment Management Calendar', 'N', 'N', 'N', 'X', 1000100, 'U', 'mxp-appt-menu-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_Menu WHERE AD_Menu_UU = 'mxp-appt-menu-001');

-- 8. AD_TreeNodeMM: add menu item under Partner Relations folder (Node 263)
INSERT INTO AD_TreeNodeMM (AD_Tree_ID, Node_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Parent_ID, SeqNo, AD_TreeNodeMM_UU)
SELECT 10, 1000100, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  263, 0, 'mxp-appt-treenode-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_TreeNodeMM WHERE AD_TreeNodeMM_UU = 'mxp-appt-treenode-001');

-- 9. AD_Form_Access: grant access to GardenWorld Admin role (102)
INSERT INTO AD_Form_Access (AD_Form_ID, AD_Role_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  IsReadWrite, AD_Form_Access_UU)
SELECT 1000100, 102, 11, 0, 'Y', NOW(), 100, NOW(), 100,
  'Y', 'mxp-appt-formaccess-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_Form_Access WHERE AD_Form_Access_UU = 'mxp-appt-formaccess-001');

-- 10. AD_Reference: X_AppointmentService (service presets, manageable from iDempiere UI)
INSERT INTO AD_Reference (AD_Reference_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, ValidationType, EntityType, AD_Reference_UU)
SELECT 1000101, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  'X_AppointmentService', 'Appointment service presets (Name=display, Description=minutes)', 'L', 'U',
  'mxp-appt-ref-service-001'
WHERE NOT EXISTS (SELECT 1 FROM AD_Reference WHERE AD_Reference_UU = 'mxp-appt-ref-service-001');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000110, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'CONSULT', '諮詢', '15', 'U', 'mxp-appt-svc-consult'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-consult');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000111, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'CLEAN', '洗牙', '30', 'U', 'mxp-appt-svc-clean'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-clean');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000112, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'FILL', '補牙', '30', 'U', 'mxp-appt-svc-fill'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-fill');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000113, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'ROOT', '根管治療', '60', 'U', 'mxp-appt-svc-root'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-root');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000114, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'IMPLANT', '植牙', '90', 'U', 'mxp-appt-svc-implant'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-implant');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000115, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'ORTHO', '矯正回診', '30', 'U', 'mxp-appt-svc-ortho'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-ortho');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000116, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'EXTRACT', '拔牙', '45', 'U', 'mxp-appt-svc-extract'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-extract');

INSERT INTO AD_Ref_List (AD_Ref_List_ID, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  AD_Reference_ID, Value, Name, Description, EntityType, AD_Ref_List_UU)
SELECT 1000117, 0, 0, 'Y', NOW(), 100, NOW(), 100, 1000101, 'OTHER', '其他', '30', 'U', 'mxp-appt-svc-other'
WHERE NOT EXISTS (SELECT 1 FROM AD_Ref_List WHERE AD_Ref_List_UU = 'mxp-appt-svc-other');

-- 11. Translations (required for zh_TW locale to display menu items)
INSERT INTO AD_Menu_Trl (AD_Menu_ID, AD_Language, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, IsTranslated, AD_Menu_Trl_UU)
SELECT 1000100, l.AD_Language, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  '預約管理', 'Appointment Management Calendar', 'Y', 'mxp-appt-menutrl-' || l.AD_Language
FROM AD_Language l
WHERE l.IsActive = 'Y' AND l.IsSystemLanguage = 'Y'
AND NOT EXISTS (SELECT 1 FROM AD_Menu_Trl t WHERE t.AD_Menu_ID = 1000100 AND t.AD_Language = l.AD_Language);

INSERT INTO AD_Form_Trl (AD_Form_ID, AD_Language, AD_Client_ID, AD_Org_ID, IsActive, Created, CreatedBy, Updated, UpdatedBy,
  Name, Description, Help, IsTranslated, AD_Form_Trl_UU)
SELECT 1000100, l.AD_Language, 0, 0, 'Y', NOW(), 100, NOW(), 100,
  '預約管理', 'Appointment Management Calendar', NULL, 'Y', 'mxp-appt-formtrl-' || l.AD_Language
FROM AD_Language l
WHERE l.IsActive = 'Y' AND l.IsSystemLanguage = 'Y'
AND NOT EXISTS (SELECT 1 FROM AD_Form_Trl t WHERE t.AD_Form_ID = 1000100 AND t.AD_Language = l.AD_Language);
