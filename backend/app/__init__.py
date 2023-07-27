import os
from datetime import datetime
from io import StringIO

import pandas as pd
from app.insight.datasource.csvSource import CsvSource
from app.insight.services.metrics import MetricsController
from config import Config
from flask import Flask, request
from flask_cors import CORS

app = Flask(__name__, static_url_path='')
CORS(app)
app.config.from_object(Config)
app._static_folder = os.path.abspath("static/")

@app.after_request
def after_request(response):
  response.headers.add('Access-Control-Allow-Origin', '*')
  response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  return response

agg_method_map = {
    "sum": "sum",
    "count": "count",
    "distinct": "nunique"
}

@app.route('/')
def main():
    return app.send_static_file('index.html')

@app.route('/dashboard')
def dashboard():
    return app.send_static_file('index.html')

@app.route('/insight', methods=['POST'])
def getInsight():
    data = request.get_json()
    csvContent = data['csvContent']
    baseDateRange = data['baseDateRange']
    comparisonDateRange = data['comparisonDateRange']
    selectedColumns = data['selectedColumns']

    baselineStart = datetime.strptime(baseDateRange['from'], '%Y-%m-%dT%H:%M:%S.%fZ').date()
    baselineEnd = datetime.strptime(baseDateRange['to'], '%Y-%m-%dT%H:%M:%S.%fZ').date()
    comparisonStart = datetime.strptime(comparisonDateRange['from'], '%Y-%m-%dT%H:%M:%S.%fZ').date()
    comparisonEnd = datetime.strptime(comparisonDateRange['to'], '%Y-%m-%dT%H:%M:%S.%fZ').date()


    date_column = list(filter(lambda x: x[1]['type'] == 'date', selectedColumns.items()))[0][0].strip()

    agg_method = list(filter(lambda x: x[1]['type'] == 'metric' or x[1]['type'] == 'supporting_metric', selectedColumns.items()))
    metrics_name = {k: k for k, v in agg_method}
    metrics_name.update({date_column: 'count'})
    agg_method = {k: agg_method_map[v['aggregationOption']] for k, v in agg_method}
    agg_method.update({date_column: 'count'})

    dimensions = list(filter(lambda x: x[1]['type'] == 'dimension', selectedColumns.items()))
    dimensions = [k for k, v in dimensions]

    df = pd.read_csv(StringIO(csvContent))
    df[date_column] = pd.to_datetime(df[date_column], utc=True)
    df['date'] = df[date_column].dt.date

    metrics = MetricsController(
        df,
        (baselineStart, baselineEnd),
        (comparisonStart, comparisonEnd),
        date_column,
        dimensions,
        agg_method,
        metrics_name,
    )

    return metrics.getMetrics()
        # return 'test'
    # except Exception as e:
    #     e.with_traceback()
    #     print('error')
    #     return 'error'

if __name__ == '__main__':
   app.run(processes=4, port=5001)
