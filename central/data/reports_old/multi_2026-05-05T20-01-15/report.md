# Multi-Run Tangle Simulation Analysis Report

*Generated: 2026-05-05T20:01:20.332817*  
*Script Version: 2.0.0*  
*Runs Analyzed: 9*

---

## Abstract

This report presents a comparative analysis of **9** tangle simulation runs. 
The analysis examines how key performance metrics—consistency, propagation delay, 
and computational overhead—scale with network parameters. Statistical correlations 
and regression analyses are provided to quantify relationships between simulation 
parameters and outcomes.

## 1. Methodology

### 1.1 Dataset Description

A total of 9 simulation runs were analyzed. 
Each run represents a complete execution of the Docknet tangle simulation 
with varying parameters including node count, transaction load, and network topology.


### 1.2 Metrics Computed

- **Consistency Score**: Percentage of transactions fully replicated across all nodes

- **Propagation Delay**: Time for transactions to reach all nodes

- **Consensus Duration**: Time to reach consensus per transaction

- **PoW Duration**: Proof-of-Work computation time

- **Resource Utilization**: CPU and memory consumption


### 1.3 Statistical Methods

Pearson correlation coefficients and linear regression were used to quantify 
relationships between parameters and outcomes. P-values indicate statistical 
significance (*p<0.05, **p<0.01, ***p<0.001). R² values represent the proportion 
of variance explained by the model.


## 2. Run Summary

**Table 1.** Summary of analyzed simulation runs.


|        Run Id |   Node Count |   Tx Count |   Tx Delay |   Max Peers |   Pow |   Consistency Score |   Propagation Delay Mean |   Pow Duration Mean |
|--------------:|-------------:|-----------:|-----------:|------------:|------:|--------------------:|-------------------------:|--------------------:|
| 1778011065.00 |         5.00 |       5.00 |     300.00 |        5.00 |  1.00 |              nan    |                   nan    |              nan    |
| 1777860461.00 |        10.00 |       5.00 |     300.00 |        5.00 |  1.00 |               43.14 |                     4.64 |                2.25 |
| 1777858179.00 |         9.00 |       5.00 |     300.00 |        5.00 |  1.00 |               95.65 |                     4.25 |                1.28 |
| 1777855907.00 |         8.00 |       5.00 |     300.00 |        5.00 |  1.00 |               65.85 |                     4.12 |                1.12 |
| 1777853649.00 |         7.00 |       5.00 |     300.00 |        5.00 |  1.00 |               83.33 |                     3.65 |                1.11 |
| 1777851376.00 |         6.00 |       5.00 |     300.00 |        5.00 |  1.00 |               25.81 |                     5.38 |                1.09 |
| 1777843914.00 |         4.00 |       5.00 |     300.00 |        5.00 |  1.00 |               57.14 |                     4.56 |                1.15 |
| 1777841705.00 |         3.00 |       5.00 |     300.00 |        5.00 |  1.00 |              100.00 |                     4.00 |                1.17 |
| 1777236195.00 |         3.00 |       5.00 |     300.00 |        5.00 |  1.00 |              100.00 |                     3.27 |                1.60 |



## 3. Descriptive Statistics

**Table 2.** Descriptive statistics for key metrics across all runs.


|       |   duration_hours |   tx_delay |   pow_duration_mean |   pow_duration_median |   pow_duration_std |   verification_duration_mean |   verification_duration_median |   verification_duration_std |   completion_duration_mean |   completion_duration_median |   completion_duration_std |   propagation_delay_mean |   propagation_delay_median |   propagation_delay_std |   consistency_score |   cpu_mean |   cpu_max |   ram_mean_mb |   ram_max_mb |
|:------|-----------------:|-----------:|--------------------:|----------------------:|-------------------:|-----------------------------:|-------------------------------:|----------------------------:|---------------------------:|-----------------------------:|--------------------------:|-------------------------:|---------------------------:|------------------------:|--------------------:|-----------:|----------:|--------------:|-------------:|
| count |            9.000 |      9.000 |               8.000 |                 8.000 |              8.000 |                        8.000 |                          8.000 |                       8.000 |                      8.000 |                        8.000 |                     8.000 |                    8.000 |                      8.000 |                   8.000 |               8.000 |      8.000 |     8.000 |         8.000 |        8.000 |
| mean  |            0.545 |    300.000 |               1.346 |                 1.000 |              1.029 |                        5.438 |                          4.375 |                       4.166 |                      1.378 |                        1.000 |                     0.990 |                    4.232 |                      3.500 |                   3.735 |              71.366 |      1.302 |    72.899 |      1267.065 |     3276.625 |
| std   |            0.207 |      0.000 |               0.403 |                 0.000 |              1.546 |                        0.675 |                          0.744 |                       3.112 |                      0.274 |                        0.000 |                     1.210 |                    0.647 |                      0.926 |                   3.486 |              27.975 |      0.516 |    29.170 |        66.681 |     1244.449 |
| min   |            0.000 |    300.000 |               1.089 |                 1.000 |              0.288 |                        4.600 |                          3.000 |                       1.562 |                      1.123 |                        1.000 |                     0.331 |                    3.267 |                      2.000 |                   0.950 |              25.806 |      0.607 |    16.764 |      1174.108 |     1497.000 |
| 25%   |            0.611 |    300.000 |               1.118 |                 1.000 |              0.324 |                        4.877 |                          4.000 |                       2.046 |                      1.233 |                        1.000 |                     0.470 |                    3.911 |                      3.000 |                   1.280 |              53.641 |      0.833 |    58.819 |      1204.804 |     2345.750 |
| 50%   |            0.624 |    300.000 |               1.158 |                 1.000 |              0.373 |                        5.447 |                          4.500 |                       2.257 |                      1.292 |                        1.000 |                     0.523 |                    4.184 |                      3.500 |                   1.588 |              74.593 |      1.370 |    76.600 |      1286.225 |     3602.500 |
| 75%   |            0.629 |    300.000 |               1.358 |                 1.000 |              0.851 |                        5.746 |                          5.000 |                       6.396 |                      1.407 |                        1.000 |                     0.784 |                    4.582 |                      4.000 |                   6.293 |              96.739 |      1.650 |   100.000 |      1316.893 |     4124.000 |
| max   |            0.636 |    300.000 |               2.253 |                 1.000 |              4.806 |                        6.425 |                          5.000 |                       9.360 |                      1.980 |                        1.000 |                     3.946 |                    5.375 |                      5.000 |                   9.766 |             100.000 |      2.040 |   100.000 |      1341.515 |     4710.000 |



## 4. Trend Analysis


### 4.1 Consistency vs Node Count

**Figure 1.** Relationship between network size and consistency score. 
The regression analysis shows a not significant trend (R²=0.118, p=0.4047) 
where consistency decreases with node count (slope=-3.543).


![Figure 1](charts/consistency_vs_nodes.png)



### 4.-1. Propagation Delay vs Transaction Load

Regression analysis: R²=0.000, p=1.0000 (not significant).


![Figure 2](charts/propagation_delay_mean_vs_tx.png)



### 4.0. PoW Duration vs Transaction Load

Regression analysis: R²=0.000, p=1.0000 (not significant).


![Figure 3](charts/pow_duration_mean_vs_tx.png)



## 5. Correlation Analysis

**Figure 4.** Pearson correlation matrix between simulation 
parameters (rows) and performance metrics (columns). 
Values range from -1 (strong negative) to +1 (strong positive).


![Figure 4](charts/correlation_matrix.png)


**Table 3.** Key statistically significant correlations (p<0.05).


| Parameter   | Metric      |     R |   p-value |
|:------------|:------------|------:|----------:|
| Node Count  | Cpu Mean    | 0.881 |    0.0038 |
| Node Count  | Ram Mean Mb | 0.877 |    0.0042 |



## 6. Distribution Analysis


### 6.-1. Propagation Delay (ms) Distribution

**Figure 5.** Cumulative distribution function 
for propagation delay (ms) across all transactions.


![Figure 5](charts/propagation_delay_cdf.png)



### 6.0. Consensus Duration (ms) Distribution


### 6.1. PoW Duration (ms) Distribution

**Figure 7.** Cumulative distribution function 
for pow duration (ms) across all transactions.


![Figure 7](charts/pow_duration_cdf.png)



## 7. Individual Run Summaries

Detailed analysis for each simulation run follows.


### 7.1. Run 1778011065

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       5 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 5       |
| Total Transactions  | 0       |
| Unique Transactions | 0       |
| Consistency Score   | 0.00%   |
| Duration (hours)    | 0.00    |



### 7.2. Run 1777860461

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |      10 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 10      |
| Total Transactions  | 408     |
| Unique Transactions | 51      |
| Consistency Score   | 43.14%  |
| Duration (hours)    | 0.64    |
| Avg CPU %           | 2.04    |
| Avg RAM (MB)        | 1341.51 |



### 7.3. Run 1777858179

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       9 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 9       |
| Total Transactions  | 400     |
| Unique Transactions | 46      |
| Consistency Score   | 95.65%  |
| Duration (hours)    | 0.63    |
| Avg CPU %           | 1.60    |
| Avg RAM (MB)        | 1309.52 |



### 7.4. Run 1777855907

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       8 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 8       |
| Total Transactions  | 286     |
| Unique Transactions | 41      |
| Consistency Score   | 65.85%  |
| Duration (hours)    | 0.63    |
| Avg CPU %           | 1.39    |
| Avg RAM (MB)        | 1290.20 |



### 7.5. Run 1777853649

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       7 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 7       |
| Total Transactions  | 228     |
| Unique Transactions | 36      |
| Consistency Score   | 83.33%  |
| Duration (hours)    | 0.62    |
| Avg CPU %           | 1.35    |
| Avg RAM (MB)        | 1282.25 |



### 7.6. Run 1777851376

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       6 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 6       |
| Total Transactions  | 163     |
| Unique Transactions | 31      |
| Consistency Score   | 25.81%  |
| Duration (hours)    | 0.63    |
| Avg CPU %           | 1.81    |
| Avg RAM (MB)        | 1339.02 |



### 7.7. Run 1777843914

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       4 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 4       |
| Total Transactions  | 66      |
| Unique Transactions | 21      |
| Consistency Score   | 57.14%  |
| Duration (hours)    | 0.62    |
| Avg CPU %           | 0.85    |
| Avg RAM (MB)        | 1209.65 |



### 7.8. Run 1777841705

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       3 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     600 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 3       |
| Total Transactions  | 48      |
| Unique Transactions | 16      |
| Consistency Score   | 100.00% |
| Duration (hours)    | 0.61    |
| Avg CPU %           | 0.61    |
| Avg RAM (MB)        | 1190.26 |



### 7.9. Run 1777236195

**Parameters:**

| Parameter   |   Value |
|:------------|--------:|
| node_count  |       3 |
| tx_count    |       5 |
| tx_delay    |     300 |
| max_peers   |       5 |
| pow         |       1 |
| wait        |     300 |


**Key Metrics:**

| Metric              | Value   |
|:--------------------|:--------|
| Total Nodes         | 3       |
| Total Transactions  | 48      |
| Unique Transactions | 16      |
| Consistency Score   | 100.00% |
| Duration (hours)    | 0.54    |
| Avg CPU %           | 0.77    |
| Avg RAM (MB)        | 1174.11 |



## 8. Conclusions

This analysis examined 
**9** simulation runs with varying network parameters. 
Key findings include:


- Average consistency score across all runs: **71.37%**



## Appendix

### A. Run IDs Used

```

1778011065, 1777860461, 1777858179, 1777855907, 1777853649, 1777851376, 1777843914, 1777841705, 1777236195

```


### B. Technical Details

| Field            | Value                      |
|:-----------------|:---------------------------|
| Generated At     | 2026-05-05T20:01:23.724645 |
| Script Version   | 2.0.0                      |
| Database Path    | /data/db.sqlite3           |
| Runs Analyzed    | 9                          |
| Charts Generated | 6                          |
| Python Version   | 3.9.2                      |

