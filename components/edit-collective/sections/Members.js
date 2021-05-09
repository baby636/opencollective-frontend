import React from 'react';
import PropTypes from 'prop-types';
import { gql } from '@apollo/client';
import { graphql } from '@apollo/client/react/hoc';
import { Edit } from '@styled-icons/material/Edit';
import { get, omit, update } from 'lodash';
import memoizeOne from 'memoize-one';
import { defineMessages, FormattedDate, FormattedMessage, injectIntl } from 'react-intl';
import styled from 'styled-components';

import roles from '../../../lib/constants/roles';
import { getErrorFromGraphqlException } from '../../../lib/errors';
import formatMemberRole from '../../../lib/i18n/member-role';
import { compose } from '../../../lib/utils';

import Avatar from '../../Avatar';
import Container from '../../Container';
import { Box, Flex, Grid } from '../../Grid';
import Link from '../../Link';
import Loading from '../../Loading';
import MessageBox from '../../MessageBox';
import StyledButton from '../../StyledButton';
import StyledRoundButton from '../../StyledRoundButton';
import StyledTag from '../../StyledTag';
import StyledTooltip from '../../StyledTooltip';
import { P } from '../../Text';
import { withUser } from '../../UserProvider';
import WarnIfUnsavedChanges from '../../WarnIfUnsavedChanges';
import SettingsTitle from '../SettingsTitle';

import EditMemberModal from './EditMemberModal';
import InviteMemberModal from './InviteMemberModal';

const MemberContainer = styled(Container)`
  position: relative;
  display: block;
  height: 100%;
  min-height: 232px;
  background: white;
  width: 170px;
  border-radius: 8px;
  border: 1px solid #c0c5cc;
`;

const InviteNewCard = styled(MemberContainer)`
  border: 1px dashed #c0c5cc;
  cursor: pointer;
`;

/** A container to center the logo above a horizontal bar */
const MemberLogoContainer = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  border-top: 1px solid #e6e8eb;
`;

const EMPTY_MEMBERS = [{}];

class Members extends React.Component {
  static propTypes = {
    collective: PropTypes.object.isRequired,
    LoggedInUser: PropTypes.object.isRequired,
    refetchLoggedInUser: PropTypes.func.isRequired,
    /** @ignore from injectIntl */
    intl: PropTypes.object.isRequired,
    /** @ignore from Apollo */
    editCoreContributors: PropTypes.func.isRequired,
    /** @ignore from Apollo */
    data: PropTypes.shape({
      loading: PropTypes.bool,
      error: PropTypes.any,
      refetch: PropTypes.func.isRequired,
      Collective: PropTypes.object,
    }),
  };

  constructor(props) {
    super(props);
    const { intl } = props;
    this.state = {
      members: this.getMembersFromProps(props),
      isTouched: false,
      isSubmitting: false,
      isSubmitted: false,
      showInviteModal: false,
      showEditModal: false,
    };
    this.messages = defineMessages({
      roleLabel: { id: 'members.role.label', defaultMessage: 'role' },
      addMember: { id: 'members.add', defaultMessage: 'Add Team Member' },
      removeMember: { id: 'members.remove', defaultMessage: 'Remove Team Member' },
      descriptionLabel: { id: 'Fields.description', defaultMessage: 'Description' },
      sinceLabel: { id: 'user.since.label', defaultMessage: 'since' },
      memberPendingDetails: {
        id: 'members.pending.details',
        defaultMessage: 'This person has not accepted their invitation yet',
      },
      cantRemoveLast: {
        id: 'members.remove.cantRemoveLast',
        defaultMessage: 'The last admin cannot be removed. Please add another admin first.',
      },
      removeConfirm: {
        id: 'members.remove.confirm',
        defaultMessage: `Do you really want to remove {name} @{slug} {hasEmail, select, 1 {({email})} other {}}?`,
      },
    });

    const getOptions = arr => {
      return arr.map(key => {
        const obj = {};
        obj[key] = formatMemberRole(intl, key);
        return obj;
      });
    };

    this.fields = [
      {
        name: 'role',
        type: 'select',
        options: getOptions([roles.ADMIN, roles.MEMBER, roles.ACCOUNTANT]),
        defaultValue: roles.ADMIN,
        label: intl.formatMessage(this.messages.roleLabel),
      },
      {
        name: 'description',
        maxLength: 255,
        label: intl.formatMessage(this.messages.descriptionLabel),
      },
      {
        name: 'since',
        type: 'date',
        defaultValue: new Date(),
        label: intl.formatMessage(this.messages.sinceLabel),
      },
    ];
  }

  componentDidUpdate(oldProps) {
    const invitations = get(this.props.data, 'memberInvitations', null);
    const oldInvitations = get(oldProps.data, 'memberInvitations', null);
    const members = get(this.props.data, 'Collective.members', null);
    const oldMembers = get(oldProps.data, 'Collective.members', null);

    if (invitations !== oldInvitations || members !== oldMembers) {
      this.setState({ members: this.getMembersFromProps(this.props) });
    }
  }

  getMembersFromProps(props) {
    const pendingInvitations = get(props.data, 'memberInvitations', EMPTY_MEMBERS);
    const pendingInvitationsMembersData = pendingInvitations.map(i => omit(i, ['id']));
    const members = get(props.data, 'Collective.members', EMPTY_MEMBERS);
    const all = [...members, ...pendingInvitationsMembersData];
    return all.length === 0 ? EMPTY_MEMBERS : all;
  }

  handleShowModalChange(modal, value, memberIdx) {
    if (modal === 'edit') {
      const currentMember = this.state.members[memberIdx];
      this.setState({ showEditModal: value, currentMember });
    }
    if (modal === 'invite') {
      this.setState({ showInviteModal: value });
    }
  }

  getMembersCollectiveIds = memoizeOne(members => {
    return members.map(member => member.member && member.member.id);
  });

  editMember = (index, fieldname, value) => {
    this.setState(state => ({
      isTouched: true,
      members: update([...state.members], index, member => ({ ...member, [fieldname]: value })),
    }));
  };

  addMember = () => {
    this.setState(state => ({
      isTouched: true,
      members: [...state.members, { role: 'ADMIN' }],
    }));
  };

  removeMember = index => {
    return this.setState(state => {
      const memberEntry = state.members[index];
      if (memberEntry.member && !this.confirmRemoveMember(memberEntry)) {
        return null;
      } else {
        const members = [...state.members];
        members.splice(index, 1);
        return { isTouched: true, members };
      }
    });
  };

  confirmRemoveMember = memberEntry => {
    return window.confirm(
      this.props.intl.formatMessage(this.messages.removeConfirm, {
        ...memberEntry.member,
        hasEmail: Number(memberEntry.member.email),
      }),
    );
  };

  handleSubmit = async () => {
    if (!this.validate) {
      return false;
    }

    try {
      this.setState({ isSubmitting: true, error: null });
      await this.props.editCoreContributors({
        variables: {
          collectiveId: this.props.collective.id,
          members: this.state.members.map(member => ({
            id: member.id,
            role: member.role,
            description: member.description,
            since: member.since,
            member: {
              id: member.member.id,
              name: member.member.name,
              email: member.member.email,
            },
          })),
        },
      });
      await this.props.data.refetch();
      await this.props.refetchLoggedInUser();
      this.setState({ isSubmitting: false, isSubmitted: true, isTouched: false });
    } catch (e) {
      this.setState({ isSubmitting: false, error: getErrorFromGraphqlException(e) });
    }
  };

  validate() {
    // Ensure all members have a collective associated
    return !this.state.members.some(m => !m.member);
  }

  renderNewMember = (member, index, nbAdmins) => {
    const { intl, collective } = this.props;

    const membersCollectiveIds = this.getMembersCollectiveIds(this.state.members);
    const isInvitation = member.__typename === 'MemberInvitation';
    const collectiveId = get(member, 'member.id');
    const memberCollective = member.member;
    const memberKey = member.id ? `member-${member.id}` : `collective-${collectiveId}`;
    const isLastAdmin = nbAdmins === 1 && member.role === roles.ADMIN && member.id;

    return (
      <MemberContainer mt={2} key={`member-new-${index}-${memberKey}`} data-cy={`member-${index}`}>
        <Container position="absolute" top="1rem" right="1rem">
          {this.state.showEditModal ? (
            <EditMemberModal
              key={`member-new-a-${index}-${memberKey}`}
              show={this.state.showEditModal}
              intl={intl}
              member={this.state.currentMember}
              collective={collective}
              membersIds={membersCollectiveIds}
              index={index}
              cancelHandler={() => this.handleShowModalChange('edit', false, index)}
              continueHandler={this.onClick}
            />
          ) : (
            <StyledRoundButton onClick={() => this.handleShowModalChange('edit', true, index)} size={26}>
              <Edit height={16} />
            </StyledRoundButton>
          )}
        </Container>
        <Flex flexDirection="column" alignItems="center">
          <MemberLogoContainer mt={50}>
            <Avatar mt={-28} src={get(memberCollective, 'imageUrl')} radius={56} />
          </MemberLogoContainer>
          <P fontSize="14px" lineHeight="20px" mt={2} mb={2}>
            {get(memberCollective, 'name')}
          </P>
          <StyledTag textTransform="uppercase" display="block" mb={2}>
            {formatMemberRole(intl, get(member, 'role'))}
          </StyledTag>
          <P fontSize="10px" lineHeight="14px" fontWeight={400} color="#9D9FA3" mb={2}>
            Since: <FormattedDate value={get(member, 'since')} />
          </P>
          <P fontSize="11px" lineHeight="16px" fontWeight={400} mb={isInvitation ? 2 : 4}>
            {get(member, 'description')}
          </P>
          {isInvitation && (
            <StyledTooltip content={intl.formatMessage(this.messages.memberPendingDetails)}>
              <StyledTag
                mt={3}
                mb={3}
                data-cy="member-pending-tag"
                textTransform="uppercase"
                display="block"
                type="info"
              >
                <FormattedMessage id="Pending" defaultMessage="Pending" />
              </StyledTag>
            </StyledTooltip>
          )}
        </Flex>
      </MemberContainer>
    );
  };

  renderForm() {
    const { intl, collective } = this.props;
    const { members, error, isSubmitting, isSubmitted, isTouched } = this.state;
    const isValid = this.validate();
    const nbAdmins = members.filter(m => m.role === roles.ADMIN && m.id).length;

    return (
      <WarnIfUnsavedChanges hasUnsavedChanges={isTouched}>
        <div className="EditMembers">
          <div className="members">
            <SettingsTitle
              subtitle={
                collective.type === 'COLLECTIVE' && (
                  <FormattedMessage
                    id="members.edit.description"
                    defaultMessage="Note: Only Collective Admins can edit this Collective and approve expenses."
                  />
                )
              }
            >
              <FormattedMessage id="EditMembers.Title" defaultMessage="Edit Team" />
            </SettingsTitle>
            <Grid gridGap={20} gridTemplateColumns={['1fr', '1fr 1fr', '1fr 1fr 1fr', '1fr 1fr 1fr 1fr']}>
              {this.state.showInviteModal ? (
                // <ConfirmationModal
                //   show={this.state.showInviteModal}
                //   header={<FormattedMessage id="editTeam.member.invite" defaultMessage="Invite Team Member" />}
                //   onClose={() => this.handleShowModalChange('invite', false)}
                //   cancelLabel={<FormattedMessage id="no" defaultMessage="No" />}
                //   cancelHandler={() => this.handleShowModalChange('invite', false)}
                //   continueLabel={<FormattedMessage id="yes" defaultMessage="Yes" />}
                //   continueHandler={this.onClick}
                // />
                <InviteMemberModal
                  show={this.state.showInviteModal}
                  intl={intl}
                  //member={this.state.currentMember}
                  //membersIds={membersCollectiveIds}
                  //index={index}
                  cancelHandler={() => this.handleShowModalChange('invite', false)}
                  continueHandler={this.onClick}
                />
              ) : (
                <InviteNewCard mt={2}>
                  <Flex
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                    onClick={() => this.handleShowModalChange('invite', true)}
                  >
                    <Flex flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                      <StyledRoundButton buttonStyle="dark" fontSize={25}>
                        +
                      </StyledRoundButton>
                      <P mt={3} color="black.700">
                        <FormattedMessage id="editTeam.member.invite" defaultMessage="Invite Team Member" />
                      </P>
                    </Flex>
                  </Flex>
                </InviteNewCard>
              )}
              {members.map((m, idx) => this.renderNewMember(m, idx, nbAdmins))}
            </Grid>
          </div>
          {/* <Container textAlign="center" py={4} mb={4} borderBottom={BORDER}>
            <StyledButton onClick={() => this.addMember()} data-cy="add-member-btn">
              + {intl.formatMessage(this.messages.addMember)}
            </StyledButton>
          </Container> */}
          {error && (
            <MessageBox type="error" withIcon my={3}>
              {error.message}
            </MessageBox>
          )}
          <Flex justifyContent="center" flexWrap="wrap" mt={5}>
            <Link href={`/${collective.slug}`}>
              <StyledButton mx={2} minWidth={200}>
                <FormattedMessage id="ViewCollectivePage" defaultMessage="View Profile page" />
              </StyledButton>
            </Link>
            <StyledButton
              buttonStyle="primary"
              onClick={this.handleSubmit}
              loading={isSubmitting}
              disabled={(isSubmitted && !isTouched) || !isValid}
              mx={2}
              minWidth={200}
              data-cy="save-members-btn"
            >
              {isSubmitted && !isTouched ? (
                <FormattedMessage id="saved" defaultMessage="Saved" />
              ) : (
                <FormattedMessage id="save" defaultMessage="Save" />
              )}
            </StyledButton>
          </Flex>
        </div>
      </WarnIfUnsavedChanges>
    );
  }

  render() {
    const { data } = this.props;

    if (data.loading) {
      return <Loading />;
    } else if (data.error) {
      return (
        <MessageBox type="error" withIcon>
          {getErrorFromGraphqlException(data.error).message}
        </MessageBox>
      );
    } else if (data.Collective?.parentCollective) {
      const parent = data.Collective.parentCollective;
      return (
        <MessageBox type="info" withIcon>
          <FormattedMessage
            id="Members.DefinedInParent"
            defaultMessage="Team members are defined in the settings of {parentName}"
            values={{
              parentName: <Link href={`/${parent.slug}/edit/members`}>{parent.name}</Link>,
            }}
          />
        </MessageBox>
      );
    } else {
      return this.renderForm();
    }
  }
}

const memberFieldsFragment = gql`
  fragment MemberFields on Member {
    id
    role
    since
    createdAt
    description
    member {
      id
      name
      slug
      type
      imageUrl(height: 64)
      ... on User {
        email
      }
    }
  }
`;

const coreContributorsQuery = gql`
  query CoreContributors($collectiveId: Int!) {
    Collective(id: $collectiveId) {
      id
      parentCollective {
        id
        slug
        type
        name
      }
      members(roles: ["ADMIN", "MEMBER", "ACCOUNTANT"]) {
        ...MemberFields
      }
    }
    memberInvitations(CollectiveId: $collectiveId) {
      id
      role
      since
      createdAt
      description
      member {
        id
        name
        slug
        type
        imageUrl(height: 64)
        ... on User {
          email
        }
      }
    }
  }
  ${memberFieldsFragment}
`;

const addCoreContributorsData = graphql(coreContributorsQuery, {
  options: props => ({
    fetchPolicy: 'network-only',
    variables: { collectiveId: props.collective.id },
  }),
});

const editCoreContributorsMutation = gql`
  mutation EditCoreContributors($collectiveId: Int!, $members: [MemberInputType!]!) {
    editCoreContributors(collectiveId: $collectiveId, members: $members) {
      id
      members(roles: ["ADMIN", "MEMBER"]) {
        ...MemberFields
      }
    }
  }
  ${memberFieldsFragment}
`;

const addEditCoreContributorsMutation = graphql(editCoreContributorsMutation, {
  name: 'editCoreContributors',
});

const addGraphql = compose(addCoreContributorsData, addEditCoreContributorsMutation);

export default injectIntl(addGraphql(withUser(Members)));
