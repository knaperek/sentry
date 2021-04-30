import React, {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import StepFour from './stepFour';
import StepOne from './stepOne';
import StepThree from './stepThree';
import StepTwo from './stepTwo';
import {App, StepFourData, StepOneData, StepThreeData, StepTwoData} from './types';

const steps = [
  t('Enter your App Store Connect credentials'),
  t('Enter your itunes credentials'),
  t('Enter your authentication code'),
  t('Choose your app'),
];

type Status = 'waiting' | 'active' | 'finished';

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

function AppStoreConnect({Body, Footer, closeModal, api, orgSlug, projectSlug}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepHeights, setStepHeights] = useState<number[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [sessionContext, setSessionContext] = useState('');
  const [useSms, setUseSms] = useState(false);

  const listRef = useRef<HTMLOListElement>(null);

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: undefined,
    keyId: undefined,
    privateKey: undefined,
  });

  const [stepTwoData, setStepTwoData] = useState<StepTwoData>({
    username: undefined,
    password: undefined,
  });

  const [stepThreeData, setStepThreeData] = useState<StepThreeData>({
    itunesAuthenticationCode: undefined,
  });

  const [stepFourData, setStepFourData] = useState<StepFourData>({
    app: undefined,
  });

  useEffect(() => {
    calcStepContentHeights();
  }, []);

  function calcStepContentHeights() {
    const listElement = listRef.current;
    if (listElement) {
      const newStepHeights = steps.map(
        (_step, index) => (listElement.children[index] as HTMLLIElement).offsetHeight
      );

      setStepHeights(newStepHeights);
    }
  }

  function goNext() {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  }

  function handleBack() {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  }

  function handleSaveAction() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
        startItunesAuthentication();
        setUseSms(false);
        break;
      case 2:
        startTwoFactorAuthentication();
        break;
      case 3:
        persistData();
        break;
      default:
        break;
    }
  }

  function handleSendVerificationCode() {
    if (useSms) {
      setUseSms(false);
    }
    startItunesAuthentication();
  }

  function handleSendSmsCode() {
    if (!useSms) {
      setUseSms(true);
    }
    startSmsAuthentication();
  }

  async function checkAppStoreConnectCredentials() {
    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/apps/`,
        {
          method: 'POST',
          data: {
            appconnectIssuer: stepOneData.issuer,
            appconnectKey: stepOneData.keyId,
            appconnectPrivateKey: stepOneData.privateKey,
          },
        }
      );

      setApps(response.apps);
      setIsLoading(false);
      goNext();
    } catch (error) {
      addErrorMessage(
        t(
          'We could not establish a connection with App Store Connect. Please check the entered App Store Connect credentials.'
        )
      );
    }
  }

  async function startItunesAuthentication() {
    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/start/`,
        {
          method: 'POST',
          data: {
            itunesUser: stepTwoData.username,
            itunesPassword: stepTwoData.password,
          },
        }
      );

      setSessionContext(response.sessionContext);
      setIsLoading(false);
      goNext();
    } catch (error) {
      addErrorMessage(
        t('The iTunes authentication failed. Please check the entered credentials.')
      );
    }
  }

  async function startTwoFactorAuthentication() {
    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/2fa/`,
        {
          method: 'POST',
          data: {
            code: stepThreeData.itunesAuthenticationCode,
            useSms,
            sessionContext,
          },
        }
      );

      setSessionContext(response.sessionContext);
      setIsLoading(false);
      // goNext();
    } catch (error) {
      addErrorMessage(
        t('The two factor authentication failed. Please check the entered code.')
      );
    }
  }

  async function startSmsAuthentication() {
    try {
      await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/requestSms/`,
        {
          method: 'POST',
          data: {sessionContext},
        }
      );
    } catch (error) {
      addErrorMessage(t('An error occured while sending the SMS. Please try again'));
    }
  }

  async function persistData() {
    setIsLoading(true);
    try {
      await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/appstoreconnect/`, {
        method: 'POST',
        data: {
          appName: stepFourData.app?.name,
          appId: stepFourData.app?.appId,
          itunesUser: stepTwoData.username,
          itunesPassword: stepTwoData.password,
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          sessionContext,
        },
      });

      //closeModal();
      setIsLoading(false);
      addSuccessMessage('App Store Connect repository was successfully added');
    } catch (error) {
      addErrorMessage(t('An error occured while saving the repository'));
    }
  }

  function isFormInValid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]?.trim());
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]?.trim());
      case 2:
        return Object.keys(StepThree).some(key => !StepThree[key]);
      case 3:
        return Object.keys(stepFourData).some(key => !stepFourData[key]);
      default:
        return false;
    }
  }

  function renderStepContent(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return <StepOne data={stepOneData} onChange={setStepOneData} />;
      case 1:
        return <StepTwo data={stepTwoData} onChange={setStepTwoData} />;
      case 2:
        return (
          <StepThree
            data={stepThreeData}
            onChange={setStepThreeData}
            onSendVerificationCode={handleSendVerificationCode}
            onSendCodeViaSms={handleSendSmsCode}
          />
        );
      case 3:
        return <StepFour apps={apps} data={stepFourData} onChange={setStepFourData} />;
      default:
        return (
          <Alert type="error" icon={<IconWarning />}>
            {t('This step could not be found.')}
          </Alert>
        );
    }
  }

  return (
    <React.Fragment>
      <Body>
        <StyledList
          symbol="colored-numeric"
          forwardRef={listRef}
          defineItemHeight={!!stepHeights.length}
        >
          {steps.map((step, index) => {
            const isActive = activeStep === index || !stepHeights.length;
            return (
              <StyledItem
                key={step}
                status={activeStep < index ? 'waiting' : isActive ? 'active' : 'finished'}
                height={stepHeights[index]}
              >
                {steps[index]}
                {isActive && renderStepContent(index)}
              </StyledItem>
            );
          })}
        </StyledList>
      </Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          {activeStep !== 0 && <Button onClick={handleBack}>{t('Back')}</Button>}
          <Button
            priority="primary"
            onClick={handleSaveAction}
            disabled={isFormInValid()}
            icon={isLoading && <LoadingIndicator mini />}
          >
            {activeStep === 3 ? t('Save') : t('Next')}
          </Button>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export default withApi(AppStoreConnect);

const getItemHeight = (defineItemHeight: boolean, height: string) => {
  if (defineItemHeight) {
    return `
      height: ${height};
      padding-bottom: 0;
    `;
  }

  return `padding-bottom: ${space(4)};`;
};

const StyledList = styled(List, {
  shouldForwardProp: p => p !== 'defineItemHeight',
})<{defineItemHeight: boolean}>`
  grid-gap: 0;
  & > li {
    transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    ${p => getItemHeight(p.defineItemHeight, '32px')}
    :not(:last-child) {
      ${p => getItemHeight(p.defineItemHeight, '52px')}
      :after {
        content: ' ';
        height: calc(100% - 24px - ${space(1)});
        width: 1px;
        background-color: ${p => p.theme.gray200};
        position: absolute;
        top: calc(24px + ${space(0.5)});
        left: ${space(1.5)};
      }
    }
  }
`;

const getStatusStyle = (theme: Theme, status: Status, height: number) => {
  if (status === 'active') {
    const heightStyle = height ? `height: ${height}px;` : '';
    return `
      && {
        :not(:last-child) {
          padding-bottom: ${space(1)};
          ${heightStyle}
        }
        ${heightStyle}
      }
    `;
  }

  if (status === 'waiting') {
    return `
      &&:before {
        background-color: ${theme.disabled};
        color: ${theme.white};
      }
      color: ${theme.disabled};
    `;
  }

  return '';
};

const StyledItem = styled(ListItem)<{status: Status; height: number}>`
  ${p => getStatusStyle(p.theme, p.status, p.height)}
`;
