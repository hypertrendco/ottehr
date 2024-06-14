import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { formatAddress } from '@zapehr/sdk';
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import React, { ReactElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import { Closure, ClosureType, ScheduleExtension } from '../types/types';
import { OVERRIDE_DATE_FORMAT } from '../helpers/formatDateTime';
import Loading from '../components/Loading';
import PageContainer from '../layout/PageContainer';
import { useApiClients } from '../hooks/useAppClients';

const SCHEDULE_CHANGES_FORMAT = 'MMM d';

export default function LocationsPage(): ReactElement {
  // connect to FHIR database
  const { fhirClient } = useApiClients();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  useEffect(() => {
    async function getLocations(): Promise<void> {
      if (!fhirClient) {
        return;
      }
      setLoading(true);
      const locationsTemp = await fhirClient.searchResources<Location>({
        resourceType: 'Location',
        searchParams: [{ name: '_count', value: '1000' }],
      });
      setLocations(locationsTemp);
      setLoading(false);
    }

    getLocations().catch((error) => console.log(error));
  }, [fhirClient]);

  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const filteredLocations = React.useMemo(() => {
    const filtered = locations.filter(
      (location) => location.name && location.name.toLowerCase().includes(searchText.toLowerCase()),
    );

    const combinedLocations = filtered.map((location) => ({
      ...location,
      combined: `${location?.address?.state} - ${location.name}`,
    }));

    combinedLocations.sort((a, b) => a.combined.localeCompare(b.combined));

    return combinedLocations;
  }, [locations, searchText]);

  // For pagination, only include the rows that are on the current page
  const pageLocations = React.useMemo(
    () =>
      filteredLocations.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage, // only show the rows from the current page
      ),
    [pageNumber, filteredLocations, rowsPerPage],
  );

  const handleChangePage = (event: unknown, newPageNumber: number): void => {
    setPageNumber(newPageNumber);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPageNumber(0);
  };

  const handleChangeSearchText = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    setSearchText(event.target.value);
  };

  const validateOverrideDates = (overrideDates: string[], date: string): string[] => {
    const luxonDate = DateTime.fromFormat(date, OVERRIDE_DATE_FORMAT);
    if (luxonDate.isValid && luxonDate >= DateTime.now().startOf('day')) {
      overrideDates.push(luxonDate.toFormat(SCHEDULE_CHANGES_FORMAT));
    }
    return overrideDates;
  };

  const validateClosureDates = (closureDates: string[], closure: Closure): string[] => {
    const today = DateTime.now().startOf('day');
    const startDate = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT);
    if (!startDate.isValid) {
      return closureDates;
    }

    if (closure.type === ClosureType.OneDay) {
      if (startDate >= today) {
        closureDates.push(startDate.toFormat(SCHEDULE_CHANGES_FORMAT));
      }
    } else if (closure.type === ClosureType.Period) {
      const endDate = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT);
      if (startDate >= today || endDate >= today) {
        closureDates.push(
          `${startDate.toFormat(SCHEDULE_CHANGES_FORMAT)} - ${endDate.toFormat(SCHEDULE_CHANGES_FORMAT)}`,
        );
      }
    }
    return closureDates;
  };

  function getLocationOverrideInformation(location: Location): string | undefined {
    const extensionTemp = location.extension;
    const extensionSchedule = extensionTemp?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
    )?.valueString;

    if (extensionSchedule) {
      const { scheduleOverrides, closures } = JSON.parse(extensionSchedule) as ScheduleExtension;
      const overrideDates = scheduleOverrides ? Object.keys(scheduleOverrides).reduce(validateOverrideDates, []) : [];
      const closureDates = closures ? closures.reduce(validateClosureDates, []) : [];
      const allDates = [...overrideDates, ...closureDates].sort((d1: string, d2: string): number => {
        // compare the single day or the first day in the period
        const startDateOne = d1.split('-')[0];
        const startDateTwo = d2.split('-')[0];
        return (
          DateTime.fromFormat(startDateOne, SCHEDULE_CHANGES_FORMAT).toSeconds() -
          DateTime.fromFormat(startDateTwo, SCHEDULE_CHANGES_FORMAT).toSeconds()
        );
      });
      const scheduleChangesSet = new Set(allDates);
      const scheduleChanges = Array.from(scheduleChangesSet);
      return scheduleChanges.length ? scheduleChanges.join(', ') : undefined;
    }
    return undefined;
  }

  const getHoursOfOperationForToday = (location: Location, time: 'open' | 'close'): any => {
    const dayOfWeek = DateTime.now().toLocaleString({ weekday: 'short' }).toLowerCase();
    const dayInfo = location?.hoursOfOperation?.find((dayInfo: any) => dayInfo?.daysOfWeek?.[0] === dayOfWeek);
    let returnTime;

    if (
      !location?.extension?.find((ext) => ext.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule')
        ?.valueString
    ) {
      return '';
    }
    const scheduleObject = JSON.parse(
      location?.extension?.find((ext) => ext.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule')
        ?.valueString ?? '',
    );
    const scheduleOverrides = scheduleObject.scheduleOverrides;
    if (scheduleObject.scheduleOverrides) {
      for (const dateKey in scheduleOverrides) {
        if (Object.hasOwnProperty.call(scheduleOverrides, dateKey)) {
          const date = DateTime.fromFormat(dateKey, OVERRIDE_DATE_FORMAT).toISODate();
          const todayDate = DateTime.local().toISODate();
          if (date === todayDate) {
            if (time === 'open') {
              return DateTime.fromFormat(scheduleOverrides[dateKey].open.toString(), 'H').toLocaleString(
                DateTime.TIME_SIMPLE,
              );
            } else {
              return DateTime.fromFormat(scheduleOverrides[dateKey].close.toString(), 'H').toLocaleString(
                DateTime.TIME_SIMPLE,
              );
            }
          }
        }
      }
    }
    if (time === 'open') {
      returnTime = dayInfo?.openingTime ? DateTime.fromISO(dayInfo?.openingTime) : undefined;
    } else {
      returnTime = dayInfo?.closingTime ? DateTime.fromISO(dayInfo?.closingTime) : DateTime.fromFormat('24', 'hh');
    }

    return returnTime ? returnTime.toLocaleString(DateTime.TIME_SIMPLE) : '';
  };

  return (
    <PageContainer>
      <Paper sx={{ padding: 2 }}>
        <TableContainer>
          {/* Locations Search Box */}
          <Box sx={{ display: 'flex' }}>
            <TextField
              id="search-locations"
              label="Search offices"
              variant="outlined"
              onChange={handleChangeSearchText}
              InputProps={{ endAdornment: <SearchIcon /> }}
              sx={{ marginBottom: 2 }}
              margin="dense"
            />
            {loading && (
              <Box sx={{ marginTop: 2, marginLeft: 'auto', marginRight: 0 }}>
                <Loading />
              </Box>
            )}
          </Box>

          <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Office name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="left">
                  Address
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="left">
                  Today&apos;s hours
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="left">
                  Upcoming schedule changes
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <Link to={`/office/${location.id}`} style={{ textDecoration: 'none' }}>
                      <Typography color="primary">{`${location?.address?.state} - ${location.name}`}</Typography>
                    </Link>
                  </TableCell>
                  <TableCell align="left">
                    <Typography>{location.address && formatAddress(location.address)}</Typography>
                  </TableCell>
                  <TableCell align="left">
                    <Typography>
                      {getHoursOfOperationForToday(location, 'open') && getHoursOfOperationForToday(location, 'close')
                        ? `${getHoursOfOperationForToday(location, 'open')} -
                                ${getHoursOfOperationForToday(location, 'close')}`
                        : 'No scheduled hours'}
                    </Typography>
                  </TableCell>
                  <TableCell align="left">
                    <Typography
                      variant="body2"
                      style={{ color: getLocationOverrideInformation(location) ? 'inherit' : otherColors.none }}
                    >
                      {getLocationOverrideInformation(location)
                        ? getLocationOverrideInformation(location)
                        : 'None Scheduled'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Table Pagination */}
          <TablePagination
            rowsPerPageOptions={[1, 5, 10, 25]}
            component="div"
            count={filteredLocations.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </PageContainer>
  );
}