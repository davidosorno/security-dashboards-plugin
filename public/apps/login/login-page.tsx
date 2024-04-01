/*
 *   Copyright OpenSearch Contributors
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

import React, { useEffect, useState } from 'react';
import {
  EuiText,
  EuiFieldText,
  EuiIcon,
  EuiSpacer,
  EuiButton,
  EuiImage,
  EuiListGroup,
  EuiForm,
  EuiFormRow,
  EuiHorizontalRule,
} from '@elastic/eui';
import { CoreStart } from '../../../../../src/core/public';
import { ClientConfigType } from '../../types';
import { validateCurrentPassword } from '../../utils/login-utils';
import {
  ANONYMOUS_AUTH_LOGIN,
  AuthType,
  OPENID_AUTH_LOGIN_WITH_FRAGMENT,
  SAML_AUTH_LOGIN_WITH_FRAGMENT,
} from '../../../common';
import { getDashboardsSignInOptions } from '../../utils/dashboards-info-utils';
import { DashboardSignInOptions } from '../configuration/types';
import { getSavedTenant } from '../../utils/storage-utils';

interface LoginPageDeps {
  http: CoreStart['http'];
  chrome: CoreStart['chrome'];
  config: ClientConfigType;
}

interface LoginButtonConfig {
  buttonname: string;
  showbrandimage: boolean;
  brandimage: string;
  buttonstyle: string;
}

export function getNextPath(serverBasePath: string) {
  const urlParams = new URLSearchParams(window.location.search);
  let nextUrl = urlParams.get('nextUrl');
  if (!nextUrl || nextUrl.toLowerCase().includes('//')) {
    // Appending the next url with trailing slash. We do so because in case the serverBasePath is empty, we can simply
    // redirect to '/'.
    nextUrl = serverBasePath + '/';
  }
  const savedTenant = getSavedTenant();
  const url = new URL(
    window.location.protocol + '//' + window.location.host + nextUrl + window.location.hash
  );
  if (
    !!savedTenant &&
    !(
      url.searchParams.has('security_tenant') ||
      url.searchParams.has('securitytenant') ||
      url.searchParams.has('securityTenant_')
    )
  ) {
    url.searchParams.append('security_tenant', savedTenant);
  }
  return url.pathname + url.search + url.hash;
}

function redirect(serverBasePath: string) {
  // navigate to nextUrl
  window.location.href = getNextPath(serverBasePath);
}

export function extractNextUrlFromWindowLocation(): string {
  const urlParams = new URLSearchParams(window.location.search);
  let nextUrl = urlParams.get('nextUrl');
  if (!nextUrl || nextUrl.toLowerCase().includes('//')) {
    nextUrl = encodeURIComponent('/');
  } else {
    nextUrl = encodeURIComponent(nextUrl);
    const hash = window.location.hash || '';
    nextUrl += hash;
  }
  return `?nextUrl=${nextUrl}`;
}

export function LoginPage(props: LoginPageDeps) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loginFailed, setloginFailed] = useState(false);
  const [loginError, setloginError] = useState('');
  const [usernameValidationFailed, setUsernameValidationFailed] = useState(false);
  const [passwordValidationFailed, setPasswordValidationFailed] = useState(false);
  const [signInOptions, setSignInOptions] = React.useState<DashboardSignInOptions[]>([]);

  // It will confirm that the sign-in option is still available. If not, it will reload the login page with the available options.
  const reValidateSignInOption = async (option: DashboardSignInOptions) => {
    const dashboardSignInOptions = await getDashboardsSignInOptions(props.http);
    const isValidOption = dashboardSignInOptions.includes(DashboardSignInOptions[option]);
    if (isValidOption === false) {
      window.location.reload();
    }
  };

  React.useEffect(() => {
    const getSignInOptions = async () => {
      try {
        const dashboardSignInOptions = await getDashboardsSignInOptions(props.http);
        setSignInOptions(dashboardSignInOptions);
      } catch (e) {
        console.error(`Unable to get sign in options ${e}`);
      }
    };

    getSignInOptions();
  }, [props.http]);

  let errorLabel: any = null;
  if (loginFailed) {
    errorLabel = (
      <EuiText id="error" color="danger" textAlign="center">
        <b>{loginError}</b>
      </EuiText>
    );
  }

  // @ts-ignore : Parameter 'e' implicitly has an 'any' type.
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear errors
    setloginFailed(false);
    setUsernameValidationFailed(false);
    setPasswordValidationFailed(false);

    // Form validation
    if (username === '') {
      setUsernameValidationFailed(true);
      return;
    }

    if (password === '') {
      setPasswordValidationFailed(true);
      return;
    }

    await reValidateSignInOption(DashboardSignInOptions.BASIC);

    try {
      await validateCurrentPassword(props.http, username, password);
      redirect(props.http.basePath.serverBasePath);
    } catch (error) {
      console.log(error);
      setloginFailed(true);
      setloginError('Invalid username or password. Please try again.');
      return;
    }
  };

  const renderLoginButton = (
    authType: string,
    loginEndPoint: string,
    buttonConfig: LoginButtonConfig
  ) => {
    const buttonId = `${authType}_login_button`;
    const loginEndPointWithPath = `${props.http.basePath.serverBasePath}${loginEndPoint}`;
    return (
      <EuiFormRow>
        <EuiButton
          data-test-subj="submit"
          aria-label={buttonId}
          size="s"
          type="prime"
          className={buttonConfig.buttonstyle || 'btn-login'}
          onClick={async () =>
            await reValidateSignInOption(DashboardSignInOptions[authType.toUpperCase()])
          }
          href={loginEndPointWithPath}
          iconType={buttonConfig.showbrandimage ? buttonConfig.brandimage : ''}
        >
          {buttonConfig.buttonname}
        </EuiButton>
      </EuiFormRow>
    );
  };

  const mapSignInOptions = (options: DashboardSignInOptions[]) => {
    const authOpts = [];
    for (let i = 0; i < options.length; i++) {
      // Dashboard sign-in options are taken from HTTP type property where the value is 'openid' and it needs to match with AuthType open_id;
      if (DashboardSignInOptions[options[i]] === DashboardSignInOptions.OPENID) {
        authOpts.push(AuthType.OPEN_ID);
      } else {
        const authType = AuthType[options[i]];
        if (authType) {
          authOpts.push(authType);
        }
      }
    }
    return authOpts;
  };

  const formOptions = (options: string | string[]) => {
    let formBody = [];
    const formBodyOp = [];
    let authOpts = mapSignInOptions(signInOptions);

    if (authOpts.length === 0) {
      if (typeof options === 'string') {
        if (options === '') {
          authOpts.push(AuthType.BASIC);
        } else {
          authOpts.push(options.toLowerCase());
        }
      } else {
        if (options && options.length === 1 && options[0] === '') {
          authOpts.push(AuthType.BASIC);
        } else {
          authOpts = [...options];
        }
      }
    }

    for (let i = 0; i < authOpts.length; i++) {
      switch (authOpts[i].toLowerCase()) {
        case AuthType.BASIC: {
          formBody.push(
            <EuiFormRow>
              <EuiFieldText
                data-test-subj="user-name"
                data-testid="username"
                aria-label="username_input"
                placeholder="Username"
                prepend={<EuiIcon type="user" />}
                onChange={(e) => setUsername(e.target.value)}
                value={username}
                isInvalid={usernameValidationFailed}
              />
            </EuiFormRow>
          );
          formBody.push(
            <EuiFormRow isInvalid={passwordValidationFailed}>
              <EuiFieldText
                data-test-subj="password"
                data-testid="password"
                aria-label="password_input"
                placeholder="Password"
                prepend={<EuiIcon type="lock" />}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                isInvalid={usernameValidationFailed}
              />
            </EuiFormRow>
          );
          const buttonId = `${AuthType.BASIC}_login_button`;
          formBody.push(
            <EuiFormRow>
              <EuiButton
                data-testid="login"
                data-test-subj="submit"
                aria-label={buttonId}
                fill
                size="s"
                type="submit"
                className={props.config.ui.basicauth.login.buttonstyle || 'btn-login'}
                onClick={handleSubmit}
              >
                Log in
              </EuiButton>
            </EuiFormRow>
          );
          break;
        }
        case AuthType.OPEN_ID: {
          const oidcConfig = props.config.ui[AuthType.OPEN_ID].login;
          const nextUrl = extractNextUrlFromWindowLocation();
          const oidcAuthLoginUrl = OPENID_AUTH_LOGIN_WITH_FRAGMENT + nextUrl;
          formBodyOp.push(renderLoginButton(AuthType.OPEN_ID, oidcAuthLoginUrl, oidcConfig));
          break;
        }
        case AuthType.SAML: {
          const samlConfig = props.config.ui[AuthType.SAML].login;
          const nextUrl = extractNextUrlFromWindowLocation();
          const samlAuthLoginUrl = SAML_AUTH_LOGIN_WITH_FRAGMENT + nextUrl;
          formBodyOp.push(renderLoginButton(AuthType.SAML, samlAuthLoginUrl, samlConfig));
          break;
        }
        case AuthType.ANONYMOUS: {
          const anonymousConfig = props.config.ui[AuthType.ANONYMOUS].login;
          formBody.push(
            renderLoginButton(AuthType.ANONYMOUS, ANONYMOUS_AUTH_LOGIN, anonymousConfig)
          );
          break;
        }
        default: {
          setloginFailed(true);
          setloginError(
            `Authentication Type: ${authOpts[i]} is not supported for multiple authentication.`
          );
          break;
        }
      }
    }

    if (authOpts.length > 1) {
      formBody.push(<EuiSpacer size="xs" />);
      formBody.push(<EuiHorizontalRule size="full" margin="xl" />);
      formBody.push(<EuiSpacer size="xs" />);
    }

    formBody = formBody.concat(formBodyOp);
    return formBody;
  };

  // TODO: Get brand image from server config
  return (
    <EuiListGroup className="login-wrapper">
      {props.config.ui.basicauth.login.showbrandimage && (
        <EuiImage
          size="fullWidth"
          alt=""
          url={props.config.ui.basicauth.login.brandimage || props.chrome.logos.OpenSearch.url}
        />
      )}
      <EuiSpacer size="s" />
      <EuiText size="m" textAlign="center">
        {props.config.ui.basicauth.login.title || 'Log in to OpenSearch Dashboards'}
      </EuiText>
      <EuiSpacer size="s" />
      <EuiText size="s" textAlign="center">
        {props.config.ui.basicauth.login.subtitle ||
          'If you have forgotten your username or password, contact your system administrator.'}
      </EuiText>
      <EuiSpacer size="s" />
      <EuiForm component="form">
        {formOptions(props.config.auth.type)}
        {errorLabel}
      </EuiForm>
    </EuiListGroup>
  );
}
