import {
  Accordion,
  AccordionBody,
  AccordionHeader,
  Bold,
  Button,
  Card,
  Divider,
  Flex,
  Subtitle,
  Text,
  Title,
} from "@tremor/react";
import { useEffect, useState } from "react";
import { useTracking } from "../../../common/tracking";
import { DataSourceType, Schema } from "../../../types/data-source";
import {
  AggregationType,
  ColumnConfig,
  ColumnType,
  DateRangeConfig,
  MetricColumn,
  PrefillConfig,
  RowCountByColumn,
  RowCountByDateAndColumn,
  TargetDirection,
} from "../../../types/report-config";
import DatePicker, { DateRangeData } from "../DatePicker";
import MultiSelector from "../MultiSelector";
import { ExpectedChangeInput } from "../NumberInput";
import SingleSelector from "../SingleSelector";
import MetricConfig from "./MetricConfig";

type Props = {
  schema: Schema;
  dataSourceType: DataSourceType;
  rowCountByColumn: RowCountByColumn;
  rowCountByDateColumn?: RowCountByDateAndColumn;
  prefilledConfigs?: PrefillConfig;
  isUploading: boolean;
  onSubmit: (
    selectedColumns: {
      [key: string]: ColumnConfig;
    },
    dateColumn: string,
    metricColumn: MetricColumn,
    supportingMetricColumn: MetricColumn[],
    groupByColumns: string[],
    baseDateRange: DateRangeConfig,
    comparisonDateRange: DateRangeConfig,
    targetDirection: TargetDirection
  ) => Promise<void>;
};

function ReportConfig({
  schema,
  dataSourceType,
  rowCountByColumn,
  rowCountByDateColumn,
  prefilledConfigs,
  isUploading,
  onSubmit,
}: Props) {
  const { trackEvent } = useTracking();

  const [dateColumn, setDateColumn] = useState<string>("");
  const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
  const [metricColumn, setMetricColumn] = useState<MetricColumn | undefined>(undefined);
  const [relevantMetricColumns, setRelevantMetricColumns] = useState<MetricColumn[]>([]);


  const [selectedColumns, setSelectedColumns] = useState<{
    [k: string]: ColumnConfig;
  }>({});
  const [comparisonDateRangeData, setComparisonDateRangeData] =
    useState<DateRangeData>({
      range: {},
      stats: {},
    });
  const [baseDateRangeData, setBaseDateRangeData] = useState<DateRangeData>({
    range: {},
    stats: {},
  });
  const [targetDirection, setTargetDirection] =
    useState<TargetDirection>("increasing");

  useEffect(() => {
    if (prefilledConfigs) {
      setSelectedColumns(prefilledConfigs.selectedColumns);
      setMetricColumn(prefilledConfigs.metricColumn);
      setDateColumn(prefilledConfigs.dateColumn);
      setGroupByColumns(prefilledConfigs.groupByColumns);
    }
  }, [prefilledConfigs]);

  const onSelectMetrics = (metrics: string[], type: ColumnType) => {
    const selectedColumnsClone = Object.assign({}, selectedColumns);
    const addedMetrics = metrics.filter(
      (m) =>
        !Object.keys(selectedColumnsClone).includes(m) ||
        (Object.keys(selectedColumnsClone).includes(m) &&
          selectedColumnsClone[m]["type"] !== type)
    );
    addedMetrics.map(
      (m) =>
        (selectedColumnsClone[m] = {
          type,
          aggregationOption: "sum",
          expectedValue: 0.0,
          fieldType: schema.fields.find((f) => f.name === m)!.type,
        })
    );
    const removedMetrics = Object.keys(selectedColumnsClone).filter(
      (m) => selectedColumnsClone[m]["type"] === type && !metrics.includes(m)
    );
    removedMetrics.map((m) => delete selectedColumnsClone[m]);
    setSelectedColumns(selectedColumnsClone);
  };

  const onSelectMetricAggregationOption = (metricColumn: MetricColumn, supportingMetric = false) => {
    if (supportingMetric) {
      setRelevantMetricColumns([...relevantMetricColumns, metricColumn]);
    } else {
      setMetricColumn(metricColumn);
    }
  };

  const onSelectMetricExpectedChange = (
    metric: string,
    expectedValue: number
  ) => {
    const selectedColumnsClone = Object.assign({}, selectedColumns);
    if (
      selectedColumnsClone[metric]["type"] !== "metric" &&
      selectedColumnsClone[metric]["type"] !== "supporting_metric"
    ) {
      throw new Error("Invalid default value update on non-metric columns.");
    }
    selectedColumnsClone[metric]["expectedValue"] = expectedValue;
    setSelectedColumns(selectedColumnsClone);
  };

  const onSelectDimension = (dimensions: string[]) => {
    const selectedColumnsClone = Object.assign({}, selectedColumns);
    const addedDimensions = dimensions.filter(
      (d) =>
        !Object.keys(selectedColumnsClone).includes(d) ||
        (Object.keys(selectedColumnsClone).includes(d) &&
          selectedColumnsClone[d]["type"] !== "dimension")
    );
    addedDimensions.map(
      (d) =>
        (selectedColumnsClone[d] = {
          type: "dimension",
          fieldType: schema.fields.find((f) => f.name === d)!.type,
        })
    );
    const removedDimension = Object.keys(selectedColumnsClone).filter(
      (d) =>
        selectedColumnsClone[d]["type"] === "dimension" &&
        !dimensions.includes(d)
    );
    removedDimension.map((m) => delete selectedColumnsClone[m]);
    setSelectedColumns(selectedColumnsClone);
    setGroupByColumns(dimensions);
  };

  const onSelectDateColumn = (dateCol: string) => {
    setDateColumn(dateCol);

    setBaseDateRangeData({ range: {}, stats: {} });
    setComparisonDateRangeData({ range: {}, stats: {} });
  };

  function getDateColumns() {
    const dateColumnsByType = schema.fields.filter(
      (h) =>
        h.type === "TIMESTAMP" || h.type === "DATE" || h.type === "DATETIME"
    );

    if (dateColumnsByType.length === 0) {
      return schema.fields.filter((h) => {
        const value = schema.previewData[0][h.name];
        if (Number.isNaN(Number(value))) {
          // parse non number string
          return !Number.isNaN(Date.parse(value));
        } else if (
          // seconds
          (Number(value) > 631152000 && Number(value) < 2082758399) ||
          // milli seconds
          (Number(value) > 631152000000 && Number(value) < 2082758399000) ||
          // micro seconds
          (Number(value) > 631152000000000 && Number(value) < 2082758399000000)
        ) {
          // Timestamp between 1990/1/1  and 2035/12/31
          return true;
        } else {
          return false;
        }
      });
    }

    return dateColumnsByType;
  }

  function trackSubmit() {
    const dimensionColumns = Object.entries(selectedColumns).filter(
      (entry) => entry[1].type === "dimension"
    );

    const numDimensions = dimensionColumns.length;
    const cardinalityProduct = dimensionColumns.reduce((acc, column) => {
      const [fieldName] = column;
      const numDistinctValues =
        schema.fields.find((field) => field.name === fieldName)
          ?.numDistinctValues ?? 1;
      return acc * numDistinctValues;
    }, 1);
    const data = {
      numDimensions,
      cardinalityProduct,
      dataSourceType,
      countRows: schema.countRows,
    };
    trackEvent("Report Submission", data);
  }

  function canSubmit() {
    const hasMetricColumn = metricColumn !== undefined && metricColumn.columnNames && metricColumn.columnNames.length > 0;

    const hasDimensionColumn = groupByColumns.length > 0;

    const hasRows =
      !rowCountByDateColumn ||
      ((comparisonDateRangeData.stats.numRows ?? 0) > 0 &&
        (baseDateRangeData.stats.numRows ?? 0) > 0);

    return (
      comparisonDateRangeData.range.from &&
      comparisonDateRangeData.range.to &&
      baseDateRangeData.range.from &&
      baseDateRangeData.range.to &&
      hasMetricColumn &&
      hasDimensionColumn &&
      hasRows
    );
  }

  function getValidMetricColumns() {
    return schema.fields
      .map((h) => h.name)
      .filter((h) => rowCountByColumn[h] > 0)
      .filter(
        (h) =>
          !(
            selectedColumns.hasOwnProperty(h) &&
            selectedColumns[h]["type"] === "date"
          )
      );
  }

  function getValidDimensionColumns() {
    return schema.fields
      .map((h) => h.name)
      .filter(
        (h) =>
          !(
            selectedColumns.hasOwnProperty(h) &&
            (selectedColumns[h]["type"] === "metric" ||
              selectedColumns[h]["type"] === "supporting_metric" ||
              selectedColumns[h]["type"] === "date")
          )
      )
      .filter((h) => !metricColumn || metricColumn.columnNames?.indexOf(h) === -1)
      .filter((h) => dateColumn !== h)
      .filter((h) => {
        if (Object.keys(rowCountByColumn).length === 0) {
          return true;
        }

        return (
          (rowCountByColumn[h] < 100 ||
            rowCountByColumn[h] / rowCountByColumn["totalRowsReserved"] <
              0.01) &&
          rowCountByColumn[h] > 0
        );
      });
  }

  function renderDatePicker() {
    if (rowCountByDateColumn && !dateColumn) {
      return null;
    }

    let countByDate;
    if (rowCountByDateColumn && dateColumn) {
      countByDate = rowCountByDateColumn[dateColumn];
      if (!countByDate) {
        return null;
      }
    }

    return (
      <DatePicker
        title={"Select date ranges"}
        countByDate={countByDate}
        comparisonDateRangeData={comparisonDateRangeData}
        setComparisonDateRangeData={setComparisonDateRangeData}
        baseDateRangeData={baseDateRangeData}
        setBaseDateRangeData={setBaseDateRangeData}
        defaultBaseDateRange={prefilledConfigs?.baseDateRange}
        defaultComparisonDateRange={prefilledConfigs?.comparisonDateRange}
      />
    );
  }

  return (
    <Card className="max-w-6xl mx-auto">
      <Title>Report Config</Title>
      <Divider />
      <div className="flex flex-col gap-4">
        <SingleSelector
          title={
            <Text className="pr-4 text-black">{"Select report type"}</Text>
          }
          labels={["Date Range Comparison Report"]}
          values={["date_range_comparison"]}
          selectedValue={"date_range_comparison"}
          onValueChange={() => {}}
          disabled={true}
          instruction={
            <Text>
              Date range comparison report compares between two date ranges on
              the selected metric and aggregated of the selected group by
              columns. Currently this is the only report type we support.
            </Text>
          }
        />
        {/* Date column selector */}
        <SingleSelector
          title={
            <Text className="pr-4 text-black">{"Select date column"}</Text>
          }
          labels={
            getDateColumns().length === 0
              ? schema.fields.map((h) => h.name)
              : getDateColumns().map((h) => h.name)
          }
          values={
            getDateColumns().length === 0
              ? schema.fields.map((h) => h.name)
              : getDateColumns().map((h) => h.name)
          }
          selectedValue={dateColumn ? dateColumn : ""}
          onValueChange={onSelectDateColumn}
          instruction={
            <Text>
              Choose the column that is parsable to dates. E.g:{" "}
              <Bold>2020-04-13</Bold>. See supported format{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="text-blue-800 underline"
                href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format"
              >
                here
              </a>
              .
            </Text>
          }
        />
        {/* Date pickers */}
        {renderDatePicker()}
        {/* Analysing metric single selector */}
        <MetricConfig
          getValidMetricColumns={getValidMetricColumns}
          metricColumn={metricColumn}
          setMetricColumn={setMetricColumn}
          targetDirection={targetDirection}
          setTargetDirection={setTargetDirection}
        />
        {/* Dimension columns multi selector */}
        {(!prefilledConfigs || Object.keys(selectedColumns).length > 0) && (
          <MultiSelector
            title={"Select group by columns"}
            includeSelectAll={true}
            labels={getValidDimensionColumns().map(
              (h) => `${h} - ${rowCountByColumn[h]} distinct values`
            )}
            values={getValidDimensionColumns()}
            selectedValues={groupByColumns}
            onValueChange={onSelectDimension}
            instruction={
              <Text>
                A list of column to aggregate the metrics based on. For instance
                user demographics (gender, age group, ...), product attributes
                (brand, category, ...).
              </Text>
            }
          />
        )}
        <Divider className="my-2" />
        <Accordion className="border-0">
          <AccordionHeader>
            <Title>
              Advanced settings <Bold>[optional]</Bold>
            </Title>
          </AccordionHeader>
          <AccordionBody className="overflow-auto">
            {/* Supporting metrics multi selector */}
            <MultiSelector
              title={
                <Text className="pr-4 text-black">
                  Select related metric columns <Bold>[optional]</Bold>
                </Text>
              }
              labels={schema.fields
                .map((h) => h.name)
                .filter(
                  (h) =>
                    !(
                      selectedColumns.hasOwnProperty(h) &&
                      selectedColumns[h]["type"] === "metric"
                    )
                )}
              values={schema.fields
                .map((h) => h.name)
                .filter(
                  (h) =>
                    !(
                      selectedColumns.hasOwnProperty(h) &&
                      selectedColumns[h]["type"] === "metric"
                    )
                )}
              selectedValues={Object.keys(selectedColumns).filter(
                (c) => selectedColumns[c]["type"] === "supporting_metric"
              )}
              onValueChange={(metrics) =>
                onSelectMetrics(metrics, "supporting_metric")
              }
              instruction={
                <Text>
                  Optional list of additional metrics to analyze together. For
                  instance you may want to analyze the number of buyers and
                  orders when analyzing the total sales revenue.
                </Text>
              }
            />
            {Object.keys(selectedColumns)
              .filter((c) => selectedColumns[c]["type"] === "supporting_metric")
              .map((m) => (
                <SingleSelector
                  title={<Subtitle className="pr-4">{m}</Subtitle>}
                  labels={["Sum", "Count", "Distinct Count"]}
                  values={["sum", "count", "distinct"]}
                  selectedValue={selectedColumns[m]["aggregationOption"]!}
                  onValueChange={(v) =>
                    onSelectMetricAggregationOption({
                      columnNames: [m],
                      aggregationOption: v as AggregationType,
                    } as MetricColumn, true)
                  }
                  key={m}
                  instruction={<Text>How to aggregation the metric.</Text>}
                />
              ))}
            {Object.keys(selectedColumns)
              .filter((c) => selectedColumns[c]["type"] === "metric")
              .map((m) => (
                <div key={m}>
                  <ExpectedChangeInput
                    key={`${m}-change-input`}
                    defaultValue={selectedColumns[m].expectedValue}
                    onValueChange={(v) =>
                      onSelectMetricExpectedChange(m, parseFloat(v) / 100)
                    }
                  />
                </div>
              ))}
          </AccordionBody>
        </Accordion>
      </div>
      <Flex justifyContent="center" className="flex-col">
        <Divider />
        <Button
          onClick={async () => {
            if (!metricColumn) {
              return;
            }

            trackSubmit();
            await onSubmit(
              selectedColumns,
              dateColumn,
              metricColumn,
              relevantMetricColumns,
              groupByColumns,
              baseDateRangeData.range,
              comparisonDateRangeData.range,
              targetDirection
            );
          }}
          loading={isUploading}
          disabled={!canSubmit()}
        >
          {isUploading ? "Uploading" : "Submit"}
        </Button>
      </Flex>
    </Card>
  );
}

export default ReportConfig;
