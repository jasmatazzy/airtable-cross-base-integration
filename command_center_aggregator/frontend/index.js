import {
    initializeBlock,
    useGlobalConfig,
    Box,
    Text,
    Input,
    Button,
    Loader,
    SelectButtons,
} from '@airtable/blocks/ui';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

const bases = [
    { id: "appfs4zGxvTQboBaV", tables: ["tblS5jJ0mSepooX7H"] },
    { id: "appPYGtuPHa89h0q4", tables: ["tbltsUZy6eLZ9ZITK"] },
    { id: "appn1reQKhPVIKYog", tables: ["tblFADrbLoMDYSgfZ"] },
    { id: "appp48r1INvb4LoGV", tables: ["tbl5CnEjWJ7zDhJVv"] },
];

const RECORDS_PER_BASE = 2500;
const RECORDS_PER_PAGE = 20;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function AirtableSearchComponent() {
    const globalConfig = useGlobalConfig();
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [yearFilters, setYearFilters] = useState([]);
    const [publicationFilters, setPublicationFilters] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [page, setPage] = useState(1);

    const AIRTABLE_API_KEY = globalConfig.get('AIRTABLE_API_KEY') || 'patl0715dDxISUHAP.db977f03c2d1bb64dad6c0ca28d355d03aff9d22c879fb9e000fda177839a0b8';

    const fetchRecordsForBase = useCallback(async (baseId, tableId) => {
        let allRecords = [];
        let offset = null;
        
        do {
            const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            const response = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            allRecords = [...allRecords, ...data.records.map(record => ({
                ...record,
                baseId,
                tableId
            }))];
            
            offset = data.offset;
            
            if (allRecords.length >= RECORDS_PER_BASE) {
                break;
            }
        } while (offset);

        return allRecords.slice(0, RECORDS_PER_BASE);
    }, [AIRTABLE_API_KEY]);

    const fetchAllRecords = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        setLoadingProgress(0);

        const cacheKey = 'airtableRecordsCache';
        const cachedData = localStorage.getItem(cacheKey);
        const currentTime = new Date().getTime();

        if (!forceRefresh && cachedData) {
            const { timestamp, records } = JSON.parse(cachedData);
            if (currentTime - timestamp < CACHE_DURATION) {
                setRecords(records);
                setIsLoading(false);
                return;
            }
        }

        let allRecords = [];
        const totalBases = bases.reduce((sum, base) => sum + base.tables.length, 0);
        let basesProcessed = 0;

        for (const base of bases) {
            for (const tableId of base.tables) {
                try {
                    const baseRecords = await fetchRecordsForBase(base.id, tableId);
                    allRecords = [...allRecords, ...baseRecords];
                    basesProcessed++;
                    setLoadingProgress(Math.round((basesProcessed / totalBases) * 100));
                } catch (error) {
                    console.error(`Error fetching records from ${base.id}, table ${tableId}:`, error);
                }
            }
        }

        setRecords(allRecords);
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: currentTime, records: allRecords }));
        setIsLoading(false);
    }, [fetchRecordsForBase]);

    useEffect(() => {
        fetchAllRecords();
    }, [fetchAllRecords]);

    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const matchesSearch = searchTerm === '' || Object.values(record.fields).some(value => 
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesYear = yearFilters.length === 0 || (record.fields.Year && yearFilters.includes(String(record.fields.Year)));
            const matchesPublication = publicationFilters.length === 0 || publicationFilters.includes(record.fields.Publication);
            return matchesSearch && matchesYear && matchesPublication;
        });
    }, [records, searchTerm, yearFilters, publicationFilters]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (page - 1) * RECORDS_PER_PAGE;
        return filteredRecords.slice(startIndex, startIndex + RECORDS_PER_PAGE);
    }, [filteredRecords, page]);

    const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE);

    const years = useMemo(() => [...new Set(records.map(r => String(r.fields.Year)).filter(Boolean))].sort(), [records]);
    const publications = useMemo(() => [...new Set(records.map(r => r.fields.Publication).filter(Boolean))].sort(), [records]);

    const aggregateData = useMemo(() => {
        const agg = {
            totalRecords: filteredRecords.length,
            recordsByYear: {},
            recordsByAuthor: {},
            recordsByPublication: {},
        };

        filteredRecords.forEach(record => {
            if (record.fields.Year) {
                agg.recordsByYear[record.fields.Year] = (agg.recordsByYear[record.fields.Year] || 0) + 1;
            }
            if (record.fields.Author) {
                const authors = Array.isArray(record.fields.Author) ? record.fields.Author : [record.fields.Author];
                authors.forEach(author => {
                    agg.recordsByAuthor[author] = (agg.recordsByAuthor[author] || 0) + 1;
                });
            }
            if (record.fields.Publication) {
                agg.recordsByPublication[record.fields.Publication] = (agg.recordsByPublication[record.fields.Publication] || 0) + 1;
            }
        });

        return agg;
    }, [filteredRecords]);

    const renderAggregationCards = () => (
        <Box display="flex" flexWrap="wrap" marginBottom={2}>
            <Box border="thick" padding={2} marginRight={2} marginBottom={2}>
                <Text fontWeight="bold">Total Records</Text>
                <Text>{aggregateData.totalRecords}</Text>
            </Box>
            <Box border="thick" padding={2} marginRight={2} marginBottom={2}>
                <Text fontWeight="bold">Top Year</Text>
                <Text>{Object.entries(aggregateData.recordsByYear).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}</Text>
            </Box>
            <Box border="thick" padding={2} marginRight={2} marginBottom={2}>
                <Text fontWeight="bold">Top 3 Authors</Text>
                {Object.entries(aggregateData.recordsByAuthor)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([author, count], index) => (
                        <Text key={author}>{index + 1}. {author} ({count})</Text>
                    ))
                }
            </Box>
            <Box border="thick" padding={2} marginBottom={2}>
                <Text fontWeight="bold">Top Publication</Text>
                <Text>{Object.entries(aggregateData.recordsByPublication).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}</Text>
            </Box>
        </Box>
    );

    const clearAllFilters = () => {
        setSearchTerm('');
        setYearFilters([]);
        setPublicationFilters([]);
        setPage(1);
    };

    return (
        <Box padding={3}>
            <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search across all bases..."
                marginBottom={2}
            />
            <Box marginBottom={2}>
                <Text fontWeight="bold">Year Filters:</Text>
                <SelectButtons
                    options={years.map(y => ({value: y, label: y}))}
                    value={yearFilters}
                    onChange={newValue => setYearFilters(newValue)}
                    width="100%"
                />
            </Box>
            <Box marginBottom={2}>
                <Text fontWeight="bold">Publication Filters:</Text>
                <SelectButtons
                    options={publications.map(p => ({value: p, label: p}))}
                    value={publicationFilters}
                    onChange={newValue => setPublicationFilters(newValue)}
                    width="100%"
                />
            </Box>
            <Box display="flex" marginBottom={2}>
                <Button
                    onClick={() => fetchAllRecords(true)}
                    marginRight={2}
                >
                    Refresh Data
                </Button>
                <Button
                    onClick={clearAllFilters}
                    marginRight={2}
                >
                    Clear All Filters
                </Button>
            </Box>
            {isLoading ? (
                <Box>
                    <Loader />
                    <Text>Loading... {loadingProgress}% complete</Text>
                </Box>
            ) : (
                <Box>
                    {renderAggregationCards()}
                    <Text marginBottom={2}>{filteredRecords.length} records found (Total records: {records.length})</Text>
                    {paginatedRecords.map(record => (
                        <Box key={record.id} marginY={2} border="thick" padding={2}>
                            <Text fontWeight="bold">
                                Base: {record.baseId}, Table: {record.tableId}
                            </Text>
                            {Object.entries(record.fields).map(([key, value]) => (
                                <Text key={key}>
                                    {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                                </Text>
                            ))}
                        </Box>
                    ))}
                    <Box display="flex" justifyContent="center" marginTop={2}>
                        <Button
                            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            disabled={page === 1}
                            marginRight={2}
                        >
                            Previous
                        </Button>
                        <Text marginRight={2}>Page {page} of {totalPages}</Text>
                        <Button
                            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={page === totalPages}
                        >
                            Next
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

initializeBlock(() => <AirtableSearchComponent />);