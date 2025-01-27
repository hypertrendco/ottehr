import { Box, Button, Divider, Typography, useTheme } from '@mui/material';
import { EventBusyOutlined } from '@mui/icons-material';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { otherColors } from '../IntakeThemeProvider';
import { getSelectors } from 'ottehr-utils';
import { useAppointmentStore } from '../features/appointments';
import { DateTime } from 'luxon';
import { FinancialPolicyDialog } from '../components/FinancialPolicyDialog';
import { useState } from 'react';
import { CancelVisitDialog } from '../components';
import { ottehrThankYou } from '../assets';

const ThankYou = (): JSX.Element => {
  const theme = useTheme();
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const { selectedSlot } = getSelectors(useAppointmentStore, ['selectedSlot']);

  const formattedDate = selectedSlot ? DateTime.fromISO(selectedSlot).toFormat('MMMM d, h:mm a') : '';
  return (
    <CustomContainer
      title="Thank you for choosing Ottehr Telemedicine"
      description="We look forward to helping you soon!"
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
    >
      <>
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', marginTop: 2, marginBottom: 2, gap: 2 }}>
          <Box>
            <img src={ottehrThankYou} alt="Clock icon" width="90px" />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle1" color="text.primary">
              Your check-in time is booked for:
            </Typography>
            <Typography variant="h3" color="secondary" mt={0.5}>
              {formattedDate}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ marginBottom: 2 }} />

        {isCancelDialogOpen && <CancelVisitDialog onClose={() => setIsCancelDialogOpen(false)} />}
        <Button
          startIcon={<EventBusyOutlined color="secondary" />}
          sx={{ marginLeft: 1.5, color: theme.palette.secondary.main }}
          onClick={() => setIsCancelDialogOpen(true)}
        >
          Cancel
        </Button>

        <Typography variant="body2" marginTop={2}>
          You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make any
          changes, please follow the instructions in the email.
        </Typography>
        <div
          style={{
            backgroundColor: otherColors.lightBlue,
            padding: 17,
            borderRadius: 8,
            marginTop: 25,
            marginBottom: 25,
          }}
        >
          <Typography variant="body2">
            All patients that present with commercial insurance will be required to leave a credit card on file. More
            details on our financial policy can be found{' '}
            <span
              style={{ cursor: 'pointer', color: theme.palette.primary.main, textDecoration: 'underline' }}
              onClick={() => setIsPolicyDialogOpen(true)}
            >
              here
            </span>
            .
          </Typography>
        </div>

        <Typography variant="body2" marginTop={2}>
          If you have any questions or concerns, please call our team at: <strong>(123) 456-7890</strong>.
        </Typography>
        {isPolicyDialogOpen && <FinancialPolicyDialog onClose={() => setIsPolicyDialogOpen(false)} />}
      </>
    </CustomContainer>
  );
};

export default ThankYou;
