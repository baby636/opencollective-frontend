import React from 'react';
import PropTypes from 'prop-types';
import { get } from 'lodash';
import { Form, Formik } from 'formik';
import { defineMessages, injectIntl } from 'react-intl';

import Avatar from '../../Avatar';
import Container from '../../Container';
import CollectivePickerAsync from '../../CollectivePickerAsync';
import { P } from '../../Text';
import { Flex, Box } from '../../Grid';
import MemberRoleDescription, { hasRoleDescription } from '../../MemberRoleDescription';
import InputField from '../../InputField';

import formatMemberRole from '../../../lib/i18n/member-role';
import roles from '../../../lib/constants/roles';
import { CollectiveType } from '../../../lib/constants/collectives';

const memberFormMessages = defineMessages({
  roleLabel: { id: 'members.role.label', defaultMessage: 'Role' },
  sinceLabel: { id: 'user.since.label', defaultMessage: 'Since' },
  descriptionLabel: { id: 'Fields.description', defaultMessage: 'Description' },
});

const MemberForm = props => {
  const { intl, member, membersIds, collectiveImg, bindSubmitForm, triggerSubmit } = props;

  const memberCollective = member.member;

  const initialValues = {
    description: get(member, 'description') || '',
    role: get(member, 'role') || '',
    since: get(member, 'since') || '',
  };

  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const submit = values => {
    if (!isSubmitted) {
      triggerSubmit(values);

      setIsSubmitted(true);
    }
  };

  const getOptions = arr => {
    return arr.map(key => {
      const obj = {};
      obj[key] = formatMemberRole(intl, key);
      return obj;
    });
  };

  const fields = [
    {
      name: 'role',
      type: 'select',
      options: getOptions([roles.ADMIN, roles.MEMBER, roles.ACCOUNTANT]),
      defaultValue: roles.ADMIN,
      label: intl.formatMessage(memberFormMessages.roleLabel),
    },
    {
      name: 'description',
      maxLength: 255,
      label: intl.formatMessage(memberFormMessages.descriptionLabel),
    },
    {
      name: 'since',
      type: 'date',
      defaultValue: new Date(),
      label: intl.formatMessage(memberFormMessages.sinceLabel),
    },
  ];

  return (
    <Flex flexDirection="column" justifyContent="center">
      {Boolean(member) ? (
        <Container>
          <Flex>
            <Container position="relative">
              <Avatar src={get(memberCollective, 'imageUrl')} radius={66} />
              <Container mt={13} position="absolute" bottom="-1rem" right="-1rem">
                <Avatar type={CollectiveType.COLLECTIVE} backgroundColor="#ffffff" src={collectiveImg} radius={30} />
              </Container>
            </Container>
            <Box mx={10}>
              <P fontSize="16px" lineHeight="24px" fontWeight={500}>
                {get(memberCollective, 'name')}
              </P>
              <P fontSize="13px" lineHeight="20px" color="#4E5052" fontWeight={400}>
                {formatMemberRole(intl, get(member, 'role'))}
              </P>
            </Box>
          </Flex>
        </Container>
      ) : (
        <CollectivePickerAsync
          inputId={`member-new-collective-picker-${index}`}
          creatable
          width="100%"
          minWidth={325}
          maxWidth={450}
          onChange={option => editMember(index, 'member', option.value)}
          getOptions={member && (buildOption => buildOption(member))}
          isDisabled={Boolean(member)}
          types={[CollectiveType.USER]}
          filterResults={collectives => collectives.filter(c => !membersIds.includes(c.id))}
          data-cy="member-collective-picker"
        />
      )}
      <Formik initialValues={initialValues} onSubmit={submit}>
        {formik => {
          const { setFieldValue, submitForm } = formik;

          bindSubmitForm(submitForm);

          return (
            <Form>
              {fields.map(field => (
                <React.Fragment key={field.name}>
                  <InputField
                    name={field.name}
                    id={field.name}
                    label={field.label}
                    type={field.type}
                    disabled={false}
                    defaultValue={get(member, field.name) || field.defaultValue}
                    options={field.options}
                    onChange={value => {
                      setFieldValue(field.name, value);
                    }}
                  />
                  {field.name === 'role' && hasRoleDescription(member.role) && (
                    <Flex mb={3}>
                      <Box mx={1} mt={1} fontSize="12px" color="black.600" fontStyle="italic">
                        <MemberRoleDescription role={member.role} />
                      </Box>
                    </Flex>
                  )}
                </React.Fragment>
              ))}
            </Form>
          );
        }}
      </Formik>
    </Flex>
  );
};

MemberForm.propTypes = {
  collectiveImg: PropTypes.string,
  onSubmit: PropTypes.func,
  member: PropTypes.object,
  memberIds: PropTypes.array,
  intl: PropTypes.object.isRequired,
};

export default injectIntl(MemberForm);
