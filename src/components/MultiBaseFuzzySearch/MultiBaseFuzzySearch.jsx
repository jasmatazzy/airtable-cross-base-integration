import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  CircularProgress,
  Autocomplete,
  Button,
  Pagination,
  Typography,
  Card,
  CardContent
} from '@mui/material';

const bases = [
  // breitbart
  { id: 'appfs4zGxvTQboBaV', tables: ['tblS5jJ0mSepooX7H'] },
  // cnn
  { id: 'appPYGtuPHa89h0q4', tables: ['tbltsUZy6eLZ9ZITK'] },
  // nyt
  { id: 'appn1reQKhPVIKYog', tables: ['tblFADrbLoMDYSgfZ'] },
  //active table
  { id: 'appp48r1INvb4LoGV', tables: ['tbl5CnEjWJ7zDhJVv'] }
];

const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY;
const RECORDS_PER_PAGE = 20;

// Utility functions for caching
const getCachedData = (key) => {
  const cachedData = localStorage.getItem(key);
  return cachedData ? JSON.parse(cachedData) : null;
};

const setCachedData = (key, data) => {
  // localStorage.setItem(key, JSON.stringify(data));
  console.log('i will be localStorage upon further implementation')
};

const AirtableSearchComponent = () => {
  const [allRecords, setAllRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilters, setYearFilters] = useState([]);
  const [authorFilters, setAuthorFilters] = useState([]);
  const [publicationFilters, setPublicationFilters] = useState([]);
  const [years, setYears] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [publications, setPublications] = useState([]);
  const [page, setPage] = useState(1);
  const [fields, setFields] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [aggregatedData, setAggregatedData] = useState(null);
  const [drillDownId, setDrillDownId] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  const fetchAllRecords = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    const cacheKey = 'airtableRecordsCache';
    const cacheDuration = 60 * 60 * 1000; // 1 hour in milliseconds

    const cachedData = getCachedData(cacheKey);
    const currentTime = new Date().getTime();

    if (!forceRefresh && cachedData && cachedData.timestamp && (currentTime - cachedData.timestamp < cacheDuration)) {
      setAllRecords(cachedData.records);
      setFields(cachedData.fields);
      setYears(cachedData.years);
      setAuthors(cachedData.authors);
      setPublications(cachedData.publications);
      setLastFetchTime(new Date(cachedData.timestamp));
      setLoading(false);
      setAggregatedData(aggregateData(cachedData.records));
      return;
    }

    let records = [];
    let allFields = new Set();
    let yearsSet = new Set();
    let authorsSet = new Set();
    let publicationsSet = new Set();

    for (const base of bases) {
      for (const tableName of base.tables) {
        let offset = null;
        do {
          try {
            const url = `https://api.airtable.com/v0/${base.id}/${tableName}${offset ? `?offset=${offset}` : ''}`;
            const response = await fetch(url, {
              headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const tableRecords = data.records.map(record => ({
              ...record,
              baseId: base.id,
              tableName
            }));
            
            records = [...records, ...tableRecords];
            
            // Process records and update sets
            tableRecords.forEach(record => {
              Object.keys(record.fields).forEach(field => allFields.add(field));
              if (record.fields.Year) yearsSet.add(record.fields.Year);
              if (record.fields.Author) {
                if (typeof record.fields.Author === 'string') {
                  const authorsList = record.fields.Author.split(/\s*,\s*|\s+and\s+|\s*;\s*/);
                  authorsList.forEach(author => authorsSet.add(author.trim()));
                } else if (Array.isArray(record.fields.Author)) {
                  record.fields.Author.forEach(author => authorsSet.add(author.trim()));
                }
              }
              if (record.fields.Publication) publicationsSet.add(record.fields.Publication);
            });

            offset = data.offset;
          } catch (error) {
            console.error(`Error fetching records from ${base.id}, table ${tableName}:`, error);
            break;
          }
        } while (offset);
      }
    }

    const processedData = {
      records,
      fields: Array.from(allFields),
      years: [...yearsSet].sort((a, b) => b - a),
      authors: [...authorsSet].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'})),
      publications: [...publicationsSet].sort(),
      timestamp: currentTime
    };

    setCachedData(cacheKey, processedData);

    setAllRecords(records);
    setFields(processedData.fields);
    setYears(processedData.years);
    setAuthors(processedData.authors);
    setPublications(processedData.publications);
    setLastFetchTime(new Date(currentTime));
    setLoading(false);

    const initialAggregation = aggregateData(records);
    setAggregatedData(initialAggregation);
  }, []);

  useEffect(() => {
    fetchAllRecords();
  }, [fetchAllRecords]);

  useEffect(() => {
    // Check for drill-down parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const drillDownParam = urlParams.get('drillDown');
    if (drillDownParam) {
      setDrillDownId(drillDownParam);
      // Perform drill-down filtering
      const drillDownRecords = allRecords.filter(record => record.id === drillDownParam);
      setFilteredRecords(drillDownRecords);
      setHasSearched(true);
    }
  }, [allRecords]);

  const fuse = useMemo(() => new Fuse(allRecords, {
    keys: ['fields.Title', 'fields.Year', 'fields.Author', 'fields.Publication'],
    threshold: 0.3,
  }), [allRecords]);

  useEffect(() => {
    let results = allRecords;

    if (searchTerm) {
      results = fuse.search(searchTerm).map(result => result.item);
    }

    results = results.filter(record => {
      const yearMatch = yearFilters.length === 0 || yearFilters.includes(record.fields.Year);
      const authorMatch = authorFilters.length === 0 || (record.fields.Author && authorFilters.some(author => record.fields.Author.includes(author)));
      const publicationMatch = publicationFilters.length === 0 || publicationFilters.includes(record.fields.Publication);
      return yearMatch && authorMatch && publicationMatch;
    });

    setFilteredRecords(results);
    setPage(1);
    setHasSearched(true);

    // Update aggregation based on filtered results
    const newAggregation = aggregateData(results);
    setAggregatedData(newAggregation);
  }, [searchTerm, yearFilters, authorFilters, publicationFilters, allRecords, fuse]);

  const aggregateData = (records) => {
    const aggregation = {
      totalRecords: records.length,
      recordsByYear: {},
      recordsByAuthor: {},
      recordsByPublication: {},
      recordsWithNoYear: 0,
      recordsWithNoAuthor: 0,
      recordsWithNoPublication: 0
    };

    records.forEach(record => {
      // Aggregate by year
      if (record.fields.Year) {
        aggregation.recordsByYear[record.fields.Year] = (aggregation.recordsByYear[record.fields.Year] || 0) + 1;
      } else {
        aggregation.recordsWithNoYear++;
      }

      // Aggregate by author
      if (record.fields.Author && typeof record.fields.Author === 'string') {
        const authors = record.fields.Author.split(/\s*,\s*|\s+and\s+|\s*;\s*/);
        authors.forEach(author => {
          const trimmedAuthor = author.trim();
          aggregation.recordsByAuthor[trimmedAuthor] = (aggregation.recordsByAuthor[trimmedAuthor] || 0) + 1;
        });
      } else if (Array.isArray(record.fields.Author)) {
        record.fields.Author.forEach(author => {
          aggregation.recordsByAuthor[author] = (aggregation.recordsByAuthor[author] || 0) + 1;
        });
      } else {
        aggregation.recordsWithNoAuthor++;
      }

      // Aggregate by publication
      if (record.fields.Publication) {
        aggregation.recordsByPublication[record.fields.Publication] = (aggregation.recordsByPublication[record.fields.Publication] || 0) + 1;
      } else {
        aggregation.recordsWithNoPublication++;
      }
    });

    return aggregation;
  };

  const paginatedRecords = filteredRecords.slice(
    (page - 1) * RECORDS_PER_PAGE,
    page * RECORDS_PER_PAGE
  );

  const renderAggregationCards = () => {
    if (!aggregatedData) return null;

    return (
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Card>
          <CardContent>
            <Typography variant="h6">Total Records</Typography>
            <Typography variant="h4">{aggregatedData.totalRecords}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">Top Year</Typography>
            <Typography variant="h4">
              {Object.entries(aggregatedData.recordsByYear).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">Top Author</Typography>
            <Typography variant="h4">
              {Object.entries(aggregatedData.recordsByAuthor).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">Top Publication</Typography>
            <Typography variant="h4">
              {Object.entries(aggregatedData.recordsByPublication).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </div>
    );
  };

  const handleRefresh = () => {
    fetchAllRecords(true);
  };


  return (
    <Paper elevation={3} style={{ padding: '20px' }}>
      {renderAggregationCards()}
      <Button 
        variant="outlined" 
        onClick={handleRefresh}
        style={{ marginBottom: '20px', marginLeft: '10px' }}
      >
        Refresh Data
      </Button>
      {lastFetchTime && (
        <Typography variant="body2" style={{ marginBottom: '20px' }}>
          Last updated: {lastFetchTime.toLocaleString()}
        </Typography>
      )}
      <TextField
        fullWidth
        label="Search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: '20px' }}
      />
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <Autocomplete
          multiple
          options={years}
          renderInput={(params) => <TextField {...params} label="Year Filter" />}
          value={yearFilters}
          onChange={(event, newValue) => setYearFilters(newValue)}
          style={{ width: '33%' }}
          getOptionLabel={(option) => String(option)}
          isOptionEqualToValue={(option, value) => option === value}
        />
        <Autocomplete
          multiple
          options={authors}
          renderInput={(params) => <TextField {...params} label="Author Filter" />}
          value={authorFilters}
          onChange={(event, newValue) => setAuthorFilters(newValue)}
          style={{ width: '33%' }}
          getOptionLabel={(option) => String(option)}
          isOptionEqualToValue={(option, value) => option === value}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={`${option}-${props['data-option-index']}`}>
              {option}
            </li>
          )}
        />
        <Autocomplete
          multiple
          options={publications}
          renderInput={(params) => <TextField {...params} label="Publication Filter" />}
          value={publicationFilters}
          onChange={(event, newValue) => setPublicationFilters(newValue)}
          style={{ width: '33%' }}
          getOptionLabel={(option) => String(option)}
          isOptionEqualToValue={(option, value) => option === value}
        />
      </div>
      <Button 
        variant="outlined" 
        onClick={() => {
          setSearchTerm('');
          setYearFilters([]);
          setAuthorFilters([]);
          setPublicationFilters([]);
          setHasSearched(false);
          setDrillDownId(null);
          window.history.pushState({}, '', window.location.pathname);
        }}
        style={{ marginBottom: '20px' }}
      >
        Clear Filters
      </Button>
      {loading ? (
        <CircularProgress style={{ margin: '20px auto', display: 'block' }} />
      ) : hasSearched ? (
        <>
          <Typography variant="body1" style={{ marginBottom: '20px' }}>
            {filteredRecords.length} relevant records found
            {drillDownId && ` (Drill-down view for record ${drillDownId})`}
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {fields.map(field => (
                    <TableCell key={field}>{field}</TableCell>
                  ))}
                  <TableCell>Base</TableCell>
                  <TableCell>Table</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow key={record.id}>
                    {fields.map(field => (
                      <TableCell key={field}>
                        {record.fields[field] !== undefined && record.fields[field] !== null
                          ? String(record.fields[field])
                          : ''}
                      </TableCell>
                    ))}
                    <TableCell>{record.baseId}</TableCell>
                    <TableCell>{record.tableName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination 
            count={Math.ceil(filteredRecords.length / RECORDS_PER_PAGE)} 
            page={page} 
            onChange={(event, value) => setPage(value)}
            style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}
          />
        </>
      ) : null}
    </Paper>
  );
};

export default AirtableSearchComponent;