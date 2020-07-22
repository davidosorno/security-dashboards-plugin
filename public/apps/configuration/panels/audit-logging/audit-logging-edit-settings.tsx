/*
 *   Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License").
 *   You may not use this file except in compliance with the License.
 *   A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   or in the "license" file accompanying this file. This file is distributed
 *   on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *   express or implied. See the License for the specific language governing
 *   permissions and limitations under the License.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  EuiButton,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiGlobalToastList,
  EuiPageHeader,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';
import { Toast } from '@elastic/eui/src/components/toast/global_toast_list';
import { cloneDeep, set, without } from 'lodash';
import { AppDependencies } from '../../../types';
import { SETTING_GROUPS, SettingMapItem } from './constants';
import { EditSettingGroup } from './edit-setting-group';
import { AuditLoggingSettings } from './types';
import { buildHashUrl } from '../../utils/url-builder';
import { ResourceType } from '../../types';
import { updateAuditLogging } from '../../utils/audit-logging-view-utils';
import { API_ENDPOINT_AUDITLOGGING } from '../../constants';

interface AuditLoggingEditSettingProps extends AppDependencies {
  setting: 'general' | 'compliance';
}

export function AuditLoggingEditSettings(props: AuditLoggingEditSettingProps) {
  const [editConfig, setEditConfig] = useState<AuditLoggingSettings>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [invalidSettings, setInvalidSettings] = useState<string[]>([]);

  const handleChange = (path: string, val: boolean | string[] | SettingMapItem) => {
    setEditConfig((previousEditedConfig) => {
      return set(cloneDeep(editConfig), path, val);
    });
  };

  const handleInvalid = (path: string, error: boolean) => {
    const invalid = without(invalidSettings, path);

    if (error) {
      invalid.push(path);
    }
    setInvalidSettings(invalid);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const rawConfig = await props.coreStart.http.get(API_ENDPOINT_AUDITLOGGING);
        const fetchedConfig = rawConfig.data.config;
        setEditConfig(fetchedConfig);
      } catch (e) {
        console.log(e);
      }
    };

    fetchConfig();
  }, [props.coreStart.http]);

  const addToast = useCallback((toastToAdd: Toast) => {
    setToasts((state) => state.concat(toastToAdd));
  }, []);

  const removeToast = (toastToDelete: Toast) => {
    setToasts(toasts.filter((toast) => toast.id !== toastToDelete.id));
  };

  const renderSaveAndCancel = () => {
    return (
      <>
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButton
              onClick={() => {
                window.location.href = buildHashUrl(ResourceType.auditLogging);
              }}
            >
              Cancel
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              isDisabled={invalidSettings.length !== 0}
              onClick={() => {
                saveConfig(editConfig);
              }}
            >
              Save
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    );
  };

  const saveConfig = async (configToUpdate: AuditLoggingSettings) => {
    try {
      await updateAuditLogging(props.coreStart.http, configToUpdate);

      const successToast: Toast = {
        id: 'update-result',
        color: 'success',
        iconType: 'check',
        title: 'Audit configuration was successfully updated.',
      };

      addToast(successToast);
    } catch (e) {
      const failureToast: Toast = {
        id: 'update-result',
        color: 'danger',
        iconType: 'alert',
        title: 'Failed to update audit configuration due to ' + e?.message,
      };

      addToast(failureToast);
    } finally {
      window.scrollTo({ top: 0 });
    }
  };

  const renderComplianceSetting = () => {
    return (
      <>
        <EuiPageHeader>
          <EuiTitle size="l">
            <h1>Compliance settings</h1>
          </EuiTitle>
        </EuiPageHeader>

        <EuiPanel>
          <EditSettingGroup
            settingGroup={SETTING_GROUPS.COMPLIANCE_CONFIG_MODE_SETTINGS}
            config={editConfig}
            handleChange={handleChange}
          />
          {editConfig.compliance && editConfig.compliance.enabled && (
            <>
              <EuiCallOut title="Warning" color="warning">
                <p>
                  Configuring Watched fields and Watched indices (compliance:read_watch_fields,
                  compliance:write_watched_indices) will <br />
                  generate one log per documented access, and may result in very large log files
                  being generated if monitoring commonly <br />
                  accessed indices and fields.
                </p>
              </EuiCallOut>

              <EuiSpacer />

              <EditSettingGroup
                settingGroup={SETTING_GROUPS.COMPLIANCE_CONFIG_SETTINGS}
                config={editConfig}
                handleChange={handleChange}
              />
              <EuiPanel>
                <EditSettingGroup
                  settingGroup={SETTING_GROUPS.COMPLIANCE_SETTINGS_READ}
                  config={editConfig}
                  handleChange={handleChange}
                  handleInvalid={handleInvalid}
                />
              </EuiPanel>
              <EuiSpacer />
              <EuiPanel>
                <EditSettingGroup
                  settingGroup={SETTING_GROUPS.COMPLIANCE_SETTINGS_WRITE}
                  config={editConfig}
                  handleChange={handleChange}
                />
              </EuiPanel>
            </>
          )}
        </EuiPanel>

        <EuiSpacer />

        {renderSaveAndCancel()}

        <EuiGlobalToastList toasts={toasts} toastLifeTimeMs={10000} dismissToast={removeToast} />
      </>
    );
  };

  const renderGeneralSettings = () => {
    return (
      <>
        <EuiPageHeader>
          <EuiTitle size="l">
            <h1>General settings</h1>
          </EuiTitle>
        </EuiPageHeader>

        <EuiPanel>
          <EuiCallOut title="Warning" color="warning">
            <p>
              Enabling REST and Transport layers (config:enable_rest, config:enable_transport) may
              result in a massive number of logs if AUTHENTICATED and GRANTED_PRIVILEGES are not
              disabled. We suggest you ignore common requests if doing so.
            </p>

            <p>
              Enabling Bulk requests (config:resolve_bulk_requests) will generate one log per
              request, and may also result in very large log files.
            </p>
          </EuiCallOut>

          <EuiSpacer />

          <EditSettingGroup
            settingGroup={SETTING_GROUPS.LAYER_SETTINGS}
            config={editConfig}
            handleChange={handleChange}
          />
          <EuiSpacer size="xl" />
          <EditSettingGroup
            settingGroup={SETTING_GROUPS.ATTRIBUTE_SETTINGS}
            config={editConfig}
            handleChange={handleChange}
          />
          <EuiSpacer size="xl" />
          <EditSettingGroup
            settingGroup={SETTING_GROUPS.IGNORE_SETTINGS}
            config={editConfig}
            handleChange={handleChange}
          />
        </EuiPanel>
        <EuiSpacer />
        {renderSaveAndCancel()}

        <EuiGlobalToastList toasts={toasts} toastLifeTimeMs={10000} dismissToast={removeToast} />
      </>
    );
  };

  if (props.setting === 'general') {
    return renderGeneralSettings();
  }

  return renderComplianceSetting();
}
