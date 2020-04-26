import React from 'react';
import PropTypes from 'prop-types';
import { FastField, Field, FieldArray, Form, Formik } from 'formik';
import { first, get, isEmpty, pick } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { CollectiveType } from '../../lib/constants/collectives';
import expenseTypes from '../../lib/constants/expenseTypes';
import { PayoutMethodType } from '../../lib/constants/payout-method';
import { ERROR, isErrorType } from '../../lib/errors';
import { formatFormErrorMessage, requireFields } from '../../lib/form-utils';
import { i18nExpenseType } from '../../lib/i18n-expense';

import CollectivePicker from '../CollectivePicker';
import { Box, Flex } from '../Grid';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import StyledButton from '../StyledButton';
import StyledCard from '../StyledCard';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputField from '../StyledInputField';
import StyledInputTags from '../StyledInputTags';
import StyledTag from '../StyledTag';
import StyledTextarea from '../StyledTextarea';
import { P, Span } from '../Text';

import ExpenseFormItems, { addNewExpenseItem } from './ExpenseFormItems';
import { validateExpenseItem } from './ExpenseItemForm';
import ExpenseTypeRadioSelect from './ExpenseTypeRadioSelect';
import PayoutMethodForm, { validatePayoutMethod } from './PayoutMethodForm';
import PayoutMethodSelect from './PayoutMethodSelect';

const msg = defineMessages({
  descriptionPlaceholder: {
    id: `ExpenseForm.DescriptionPlaceholder`,
    defaultMessage: 'Enter expense title here...',
  },
  payeeLabel: {
    id: `ExpenseForm.payeeLabel`,
    defaultMessage: 'Who is being paid for this expense?',
  },
  payoutOptionLabel: {
    id: `ExpenseForm.PayoutOptionLabel`,
    defaultMessage: 'Payout method',
  },
  invoiceInfo: {
    id: 'ExpenseForm.InvoiceInfo',
    defaultMessage: 'Additional invoice information',
  },
  invoiceInfoPlaceholder: {
    id: 'ExpenseForm.InvoiceInfoPlaceholder',
    defaultMessage: 'Tax ID, VAT number, etc. This information will be printed on your invoice.',
  },
  leaveWithUnsavedChanges: {
    id: 'ExpenseForm.UnsavedChangesWarning',
    defaultMessage: 'If you cancel now you will loose any changes made to this expense. Are you sure?',
  },
  addNewReceipt: {
    id: 'ExpenseForm.AddReceipt',
    defaultMessage: 'Add new receipt',
  },
  addNewItem: {
    id: 'ExpenseForm.AddLineItem',
    defaultMessage: 'Add new item',
  },
  step1: {
    id: 'ExpenseForm.Step1',
    defaultMessage: 'Upload one or multiple receipt',
  },
  step1Invoice: {
    id: 'ExpenseForm.Step1Invoice',
    defaultMessage: 'Set invoice details',
  },
  step2: {
    id: 'ExpenseForm.Step2',
    defaultMessage: 'Reimbursements details',
  },
  step2Invoice: {
    id: 'ExpenseForm.Step2Invoice',
    defaultMessage: 'Vendor information',
  },
});

const getDefaultExpense = (collective, payoutProfiles) => ({
  description: '',
  items: [],
  payee: first(payoutProfiles),
  payoutMethod: undefined,
  privateInfo: '',
  currency: collective.currency,
});

/**
 * Take the expense's data as generated by `ExpenseForm` and strips out all optional data
 * like URLs for items when the expense is an invoice.
 */
export const prepareExpenseForSubmit = expenseData => {
  // The collective picker still uses API V1 for when creating a new profile on the fly
  const payeeIdField = typeof expenseData.payee?.id === 'string' ? 'id' : 'legacyId';
  return {
    ...pick(expenseData, ['id', 'description', 'type', 'privateMessage', 'invoiceInfo', 'tags']),
    payee: expenseData.payee && { [payeeIdField]: expenseData.payee.id },
    payoutMethod: pick(expenseData.payoutMethod, ['id', 'name', 'data', 'isSaved', 'type']),
    attachedFiles: expenseData.attachedFiles?.map(file => pick(file, ['id', 'url'])),
    // Omit item's ids that were created for keying purposes
    items: expenseData.items.map(item => {
      return pick(item, [
        ...(item.__isNew ? [] : ['id']),
        ...(expenseData.type === expenseTypes.INVOICE ? [] : ['url']), // never submit URLs for invoices
        'description',
        'incurredAt',
        'amount',
      ]);
    }),
  };
};

/**
 * Validate the expense
 */
const validate = expense => {
  const errors = requireFields(expense, ['description', 'payee', 'payoutMethod', 'currency']);

  if (expense.items.length > 0) {
    const itemsErrors = expense.items.map(item => validateExpenseItem(expense, item));
    const hasErrors = itemsErrors.some(errors => !isEmpty(errors));
    if (hasErrors) {
      errors.items = itemsErrors;
    }
  }

  if (expense.payoutMethod) {
    const payoutMethodErrors = validatePayoutMethod(expense.payoutMethod);
    if (!isEmpty(payoutMethodErrors)) {
      errors.payoutMethod = payoutMethodErrors;
    }
  }

  return errors;
};

// Margin x between inline fields, not displayed on mobile
const fieldsMarginRight = [2, 3, 4];

const ExpenseFormBody = ({ formik, payoutProfiles, collective, autoFocusTitle, onCancel, formPersister }) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { values, handleChange, errors, setValues, dirty } = formik;
  const hasBaseFormFieldsCompleted = values.type && values.description;
  const stepOneCompleted = hasBaseFormFieldsCompleted && values.items.length > 0;
  const stepTwoCompleted = stepOneCompleted && values.payoutMethod;
  const isReceipt = values.type === expenseTypes.RECEIPT;

  // When user logs in we set its account as the default payout profile if not yet defined
  React.useEffect(() => {
    if (!values.payee && !isEmpty(payoutProfiles)) {
      formik.setFieldValue('payee', first(payoutProfiles));
    }
  }, [payoutProfiles]);

  // Load values from localstorage
  React.useEffect(() => {
    if (formPersister && !dirty) {
      const formValues = formPersister.loadValues();
      if (formValues) {
        // Reset payoutMethod if host is no longer connected to TransferWise
        if (formValues.payoutMethod?.type === PayoutMethodType.BANK_ACCOUNT && !collective.host.transferwise) {
          formValues.payoutMethod = undefined;
        }
        setValues(formValues);
      }
    }
  }, [formPersister, dirty]);

  // Save values in localstorage
  React.useEffect(() => {
    if (dirty && formPersister) {
      formPersister.saveValues(values);
    }
  }, [formPersister, dirty, values]);

  return (
    <Form>
      <ExpenseTypeRadioSelect name="type" onChange={handleChange} value={values.type} />
      {values.type && (
        <Box width="100%">
          <StyledCard mt={4} p={[16, 24, 32]} overflow="initial">
            <Field
              as={StyledInput}
              autoFocus={autoFocusTitle}
              name="description"
              placeholder={formatMessage(msg.descriptionPlaceholder)}
              width="100%"
              fontSize="H4"
              border="0"
              error={errors.description}
              px={0}
              maxLength={255}
              withOutline
            />
            <Flex alignItems="flex-start">
              <StyledTag variant="rounded-left" type="dark" mb="4px" mr="4px">
                {i18nExpenseType(intl, values.type, values.legacyId)}
              </StyledTag>
              <StyledInputTags
                onChange={tags =>
                  formik.setFieldValue(
                    'tags',
                    tags.map(t => t.value.toUpperCase()),
                  )
                }
                value={values.tags}
              />
            </Flex>
            {errors.description && (
              <P color="red.500" mt={2}>
                {formatFormErrorMessage(intl, errors.description)}
              </P>
            )}
            <Flex alignItems="center" my={24}>
              <Span color="black.900" fontSize="LeadParagraph" lineHeight="LeadCaption" fontWeight="bold">
                {formatMessage(isReceipt ? msg.step1 : msg.step1Invoice)}
              </Span>
              <StyledHr flex="1" borderColor="black.300" mx={2} />
              <StyledButton
                buttonSize="tiny"
                type="button"
                onClick={() => addNewExpenseItem(formik)}
                minWidth={135}
                data-cy="expense-add-item-btn"
              >
                +&nbsp;{formatMessage(isReceipt ? msg.addNewReceipt : msg.addNewItem)}
              </StyledButton>
            </Flex>
            <Box>
              <FieldArray name="items" component={ExpenseFormItems} />
            </Box>
            {stepOneCompleted && (
              <React.Fragment>
                <Flex alignItems="center" my={24}>
                  <Span color="black.900" fontSize="LeadParagraph" lineHeight="LeadCaption" fontWeight="bold">
                    {formatMessage(isReceipt ? msg.step2 : msg.step2Invoice)}
                  </Span>
                  <Box ml={2}>
                    <PrivateInfoIcon size={12} color="#969BA3" tooltipProps={{ display: 'flex' }} />
                  </Box>
                  <StyledHr flex="1" borderColor="black.300" mx={2} />
                </Flex>

                <Box>
                  <Flex justifyContent="space-between" flexWrap="wrap">
                    <FastField name="payee">
                      {({ field }) => (
                        <StyledInputField
                          name={field.name}
                          label={formatMessage(msg.payeeLabel)}
                          flex="1"
                          minWidth={250}
                          mr={fieldsMarginRight}
                          mt={2}
                        >
                          {({ id }) => (
                            <CollectivePicker
                              creatable
                              addLoggedInUserAsAdmin
                              types={[CollectiveType.ORGANIZATION]}
                              inputId={id}
                              collectives={payoutProfiles}
                              getDefaultOptions={build => values.payee && build(values.payee)}
                              data-cy="select-expense-payee"
                              onChange={({ value }) => {
                                formik.setFieldValue('payee', value);
                                formik.setFieldValue('payoutMethod', null);
                              }}
                            />
                          )}
                        </StyledInputField>
                      )}
                    </FastField>

                    <Field name="payoutMethod">
                      {({ field }) => (
                        <StyledInputField
                          name={field.name}
                          htmlFor="payout-method"
                          flex="1"
                          mr={fieldsMarginRight}
                          mt={2}
                          minWidth={250}
                          label={formatMessage(msg.payoutOptionLabel)}
                          error={
                            isErrorType(errors.payoutMethod, ERROR.FORM_FIELD_REQUIRED)
                              ? formatFormErrorMessage(intl, errors.payoutMethod)
                              : null
                          }
                        >
                          {({ id, error }) => (
                            <PayoutMethodSelect
                              inputId={id}
                              error={error}
                              onChange={({ value }) => formik.setFieldValue('payoutMethod', value)}
                              payoutMethod={values.payoutMethod}
                              payoutMethods={get(values.payee, 'payoutMethods', [])}
                              disabled={!values.payee}
                              collective={collective}
                              default
                            />
                          )}
                        </StyledInputField>
                      )}
                    </Field>
                  </Flex>
                  <Flex justifyContent="space-between" mt={3} flexWrap="wrap">
                    {values.type === expenseTypes.INVOICE && (
                      <FastField name="invoiceInfo">
                        {({ field }) => (
                          <StyledInputField
                            name={field.name}
                            label={formatMessage(msg.invoiceInfo)}
                            required={false}
                            flex="1"
                            minWidth={250}
                            maxWidth={[null, null, '46%']}
                            mr={fieldsMarginRight}
                            mt={2}
                          >
                            {inputProps => (
                              <Field
                                as={StyledTextarea}
                                {...inputProps}
                                {...field}
                                minHeight={80}
                                placeholder={formatMessage(msg.invoiceInfoPlaceholder)}
                              />
                            )}
                          </StyledInputField>
                        )}
                      </FastField>
                    )}
                    {values.payoutMethod && (
                      <FastField name="payoutMethod">
                        {({ field, meta }) => (
                          <Box mr={fieldsMarginRight} mt={2} flex="1" minWidth={258}>
                            <PayoutMethodForm
                              fieldsPrefix="payoutMethod"
                              payoutMethod={field.value}
                              collective={collective}
                              errors={meta.error}
                            />
                          </Box>
                        )}
                      </FastField>
                    )}
                  </Flex>
                </Box>
              </React.Fragment>
            )}
          </StyledCard>
        </Box>
      )}
      <Flex mt={4} flexWrap="wrap">
        {onCancel && (
          <StyledButton
            type="button"
            data-cy="expense-cancel-btn"
            disabled={formik.isSubmitting}
            mt={2}
            minWidth={175}
            width={['100%', 'auto']}
            mx={[2, 0]}
            mr={[null, 3]}
            whiteSpace="nowrap"
            onClick={() => {
              if (!formik.dirty || confirm(formatMessage(msg.leaveWithUnsavedChanges))) {
                onCancel();
              }
            }}
          >
            <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
          </StyledButton>
        )}
        <StyledButton
          type="submit"
          minWidth={175}
          width={['100%', 'auto']}
          mx={[2, 0]}
          mr={[null, 3]}
          mt={2}
          whiteSpace="nowrap"
          data-cy="expense-summary-btn"
          buttonStyle="primary"
          disabled={!stepTwoCompleted || !formik.isValid}
          loading={formik.isSubmitting}
        >
          <FormattedMessage id="Expense.ReviewSummary" defaultMessage="Review expense summary" />
          &nbsp;→
        </StyledButton>
      </Flex>
    </Form>
  );
};

ExpenseFormBody.propTypes = {
  formik: PropTypes.object,
  payoutProfiles: PropTypes.array,
  autoFocusTitle: PropTypes.bool,
  onCancel: PropTypes.func,
  formPersister: PropTypes.object,
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    host: PropTypes.shape({
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.string),
      }),
    }),
  }).isRequired,
};

/**
 * Main create expense form
 */
const ExpenseForm = ({
  onSubmit,
  collective,
  expense,
  payoutProfiles,
  autoFocusTitle,
  onCancel,
  validateOnChange,
  formPersister,
}) => {
  const [hasValidate, setValidate] = React.useState(validateOnChange);

  return (
    <Formik
      initialValues={{ ...getDefaultExpense(collective, payoutProfiles), ...expense }}
      validate={hasValidate && validate}
      onSubmit={async (values, formik) => {
        // We initially let the browser do the validation. Then once users try to submit the
        // form at least once, we validate on each change to make sure they fix all the errors.
        const errors = validate(values);
        if (!isEmpty(errors)) {
          setValidate(true);
          formik.setErrors(errors);
        } else {
          return onSubmit(values);
        }
      }}
    >
      {formik => (
        <ExpenseFormBody
          formik={formik}
          payoutProfiles={payoutProfiles}
          collective={collective}
          autoFocusTitle={autoFocusTitle}
          onCancel={onCancel}
          formPersister={formPersister}
        />
      )}
    </Formik>
  );
};

ExpenseForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  autoFocusTitle: PropTypes.bool,
  validateOnChange: PropTypes.bool,
  onCancel: PropTypes.func,
  /** To save draft of form values */
  formPersister: PropTypes.object,
  collective: PropTypes.shape({
    currency: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    host: PropTypes.shape({
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.string),
      }),
    }),
  }).isRequired,
  /** If editing */
  expense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    description: PropTypes.string,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
  /** Payout profiles that user has access to */
  payoutProfiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      slug: PropTypes.string,
      payoutMethods: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          type: PropTypes.oneOf(Object.values(PayoutMethodType)),
          name: PropTypes.string,
          data: PropTypes.object,
        }),
      ),
    }),
  ),
};

ExpenseForm.defaultProps = {
  validateOnChange: false,
};

export default React.memo(ExpenseForm);
