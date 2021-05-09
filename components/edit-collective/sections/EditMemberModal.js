import React from 'react';
import { useMutation } from '@apollo/client';
import PropTypes from 'prop-types';
import { get } from 'lodash';

import { FormattedMessage } from 'react-intl';

import MemberForm from './MemberForm';

import Container from '../../Container';
import Modal, { ModalBody, ModalHeader, ModalFooter } from '../../StyledModal';
import StyledButton from '../../StyledButton';

import { API_V2_CONTEXT, gqlV2 } from '../../../lib/graphql/helpers';
import { editCollectivePageQuery } from '../../../lib/graphql/queries';

const editMemberMutation = gqlV2/* GraphQL */ `
  mutation EditMember(
    $memberAccount: AccountReferenceInput!
    $account: AccountReferenceInput!
    $role: MemberRole
    $description: String
    $since: ISODateTime
  ) {
    editMember(
      memberAccount: $memberAccount
      account: $account
      role: $role
      description: $description
      since: $since
    ) {
      id
    }
  }
`;

const EditMemberModal = props => {
  const { intl, member, index, editMember, show, collective, membersIds, cancelHandler, continueHandler } = props;

  const [submitting, setSubmitting] = React.useState(false);

  const mutationOptions = {
    context: API_V2_CONTEXT,
    refetchQueries: [{ query: editCollectivePageQuery, variables: { slug: 'webpack' } }],
    awaitRefetchQueries: true,
  };

  const [editMemberAccount, { loading, error: editError }] = useMutation(editMemberMutation, mutationOptions);

  let submitMemberForm = null;

  const bindSubmitForm = submitForm => {
    submitMemberForm = submitForm;
  };

  const handleSubmitForm = async values => {
    if (submitMemberForm) {
      submitMemberForm();

      const { description, role, since } = values;

      const {
        data: { editMemberAccount: editedMemberAccount },
      } = await editMemberAccount({
        variables: {
          memberAccount: {
            slug: get(member.member, 'slug'),
          },
          account: { slug: get(collective, 'slug') },
          description,
          role,
          since,
        },
      });
      setSubmitting(true);
    }
  };

  return (
    <React.Fragment>
      <Modal show={show} onClose={cancelHandler}>
        <ModalHeader>
          <FormattedMessage id="editTeam.member.edit" defaultMessage="Edit Team Member" />
        </ModalHeader>
        <ModalBody>
          <MemberForm
            intl={intl}
            collectiveImg={get(collective, 'imageUrl')}
            membersIds={membersIds}
            member={member}
            index={index}
            editMember={editMember}
            bindSubmitForm={bindSubmitForm}
            triggerSubmit={handleSubmitForm}
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
              disabled={submitting}
              data-cy="confirmation-modal-cancel"
            >
              <FormattedMessage id="no" defaultMessage="No" />
            </StyledButton>
            <StyledButton
              my={1}
              minWidth={140}
              buttonStyle="primary"
              data-cy="confirmation-modal-continue"
              loading={submitting}
              onClick={handleSubmitForm}
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
