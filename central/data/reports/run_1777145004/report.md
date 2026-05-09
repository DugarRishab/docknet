# Tangle Simulation Report — Run 1777145004

*Generated: 2026-04-25T19:56:44.112614*

*Script version: 1.0.0*

---

## Run Summary

| Metric               | Value               |
|:---------------------|:--------------------|
| Run ID               | 1777145004          |
| Status               | complete            |
| Started              | 2026-04-25 19:23:24 |
| Ended                |                     |
| Duration             | N/A                 |
| Node Count (params)  | 3                   |
| Tx Count (params)    | 3                   |
| Tx Delay (ms)        | 100                 |
| Max Peers            | 3                   |
| PoW                  | 1                   |
| Wait (ms)            | 100                 |
| Total Nodes (actual) | 3                   |
| Total Transactions   | 30                  |
| Unique Transactions  | 10                  |
| Total Hops           | 50                  |
| Total Peers          | 6                   |
| Metrics Records      | 1245                |


## Node Overview

|   Index | Node ID                 |   Tx Count |   Peer Count |   Has Metrics |
|--------:|:------------------------|-----------:|-------------:|--------------:|
|       1 | g7BhUAAeZCiyk9D/497q... |         10 |            2 |             1 |
|       2 | wPWQRX1tnEUK6GHZpu3T... |         10 |            2 |             1 |
|       3 | YeGt5atQa67+lx8EsGp9... |         10 |            2 |             1 |


![Transactions per Node](charts/tx_per_node.png)


## Transaction Timing Statistics

![PoW Duration (ms) Distribution](charts/pow_duration_distribution.png)


![Verification Duration (ms) Distribution](charts/verification_duration_distribution.png)


![Completion Duration (ms) Distribution](charts/completion_duration_distribution.png)


![Propagation Delay (ms) Distribution](charts/propagation_delay_distribution.png)


![Avg Propagation per Hop (ms) Distribution](charts/avg_propagation_delay_distribution.png)


| Metric                       |   Count |   Mean |   Median |   P95 |
|:-----------------------------|--------:|-------:|---------:|------:|
| PoW Duration (ms)            |      15 |   1.4  |        1 |   3   |
| Consensus Duration (ms)      |       0 |   0    |        0 |   0   |
| Verification Duration (ms)   |      27 |  16.22 |       16 |  36   |
| Completion Duration (ms)     |      27 |   6.89 |        5 |  27   |
| Propagation Delay (ms)       |       9 |  10.67 |       11 |  15.2 |
| Avg Propagation per Hop (ms) |       9 |   9.22 |       11 |  14   |


## Consistency Analysis

| Metric                  | Value   |
|:------------------------|:--------|
| Consistency Score       | 100.00% |
| Fully Replicated Tx     | 10      |
| Partially Replicated Tx | 0       |
| Total Unique Tx         | 10      |
| Parent Conflicts        | 0       |
| Signature Conflicts     | 0       |
| Data Conflicts          | 0       |
| Weight Differences      | 0       |
| Consensus Differences   | 0       |


![Consistency](charts/consistency_pie.png)


### Replication Distribution

How many nodes have each transaction:


| Node Count   |   Transactions |
|:-------------|---------------:|
| 3 nodes      |             10 |


![Replication Distribution](charts/replication_histogram.png)


## Peer Topology

| Metric                 |   Value |
|:-----------------------|--------:|
| Total Peer Connections |       6 |
| Avg Peers per Node     |       2 |
| Isolated Nodes         |       0 |
| Peers in state 2       |       6 |


![Peers per Node](charts/peers_per_node.png)


## Resource Metrics

Total metric records: 1245


![CPU Over Time](charts/cpu_over_time.png)


![RAM Over Time](charts/ram_over_time.png)


### RAM Statistics per Node

|   Node |   Avg RAM Used (MB) |   Max RAM Used (MB) |   Total RAM (MB) |
|-------:|--------------------:|--------------------:|-----------------:|
|      1 |             1104.15 |                1255 |             3583 |
|      2 |             1104.15 |                1255 |             3583 |
|      3 |             1104.15 |                1255 |             3583 |


## Appendix

| Field           | Value                      |
|:----------------|:---------------------------|
| Generated At    | 2026-04-25T19:56:58.705878 |
| Script Version  | 1.0.0                      |
| Database Path   | /data/db.sqlite3           |
| Run ID          | 1777145004                 |
| Internal Run ID | 1                          |
| Charts Created  | 11                         |

