import React from 'react';
import PropTypes from 'prop-types';

import { FormattedMessage } from 'react-intl';

import MemberForm from './MemberForm';

import Container from '../../Container';
import Modal, { ModalBody, ModalHeader, ModalFooter } from '../../StyledModal';
import StyledButton from '../../StyledButton';

import { API_V2_CONTEXT, gqlV2 } from '../../../lib/graphql/helpers';

const EditMemberModal = props => {
  const { intl, member, index, editMember, show, collectiveImg, membersIds, cancelHandler, continueHandler } = props;

  return (
    <React.Fragment>
      <Modal show={show} onClose={cancelHandler}>
        <ModalHeader>
          <FormattedMessage id="editTeam.member.edit" defaultMessage="Edit Team Member" />
        </ModalHeader>
        <ModalBody>
          <MemberForm
            intl={intl}
            collectiveImg={collectiveImg}
            membersIds={membersIds}
            member={member}
            index={index}
            editMember={editMember}
          />
        </ModalBody>
        <ModalFooter>
          <Container display="flex" justifyContent={['center', 'flex-end']} flexWrap="Wrap">
            <StyledButton
              mx={20}
              my={1}
              autoFocus
              minWidth={140}
              onClick={cancelHandler}
              //disabled={submitting}
              data-cy="confirmation-modal-cancel"
            >
              <FormattedMessage id="no" defaultMessage="No" />
            </StyledButton>
            <StyledButton
              my={1}
              minWidth={140}
              buttonStyle="primary"
              data-cy="confirmation-modal-continue"
              //loading={submitting}
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await continueHandler();
                } catch (e) {
                  setSubmitting(false);
                  throw e;
                }
              }}
            >
              <FormattedMessage id="yes" defaultMessage="Yes" />
            </StyledButton>
          </Container>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default EditMemberModal;
