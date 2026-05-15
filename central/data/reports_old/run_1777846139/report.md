# Tangle Simulation Report — Run 1777846139

*Generated: 2026-05-03T23:36:07.715558*

*Script version: 1.0.0*

---

## Run Summary

| Metric               | Value               |
|:---------------------|:--------------------|
| Run ID               | 1777846139          |
| Status               | complete            |
| Started              | 2026-05-03 22:08:59 |
| Ended                | 2026-05-03 23:36:06 |
| Duration             | 1:27:07             |
| Node Count (params)  | 5                   |
| Tx Count (params)    | 15                  |
| Tx Delay (ms)        | 300                 |
| Max Peers            | 5                   |
| PoW                  | 1                   |
| Wait (ms)            | 600                 |
| Total Nodes (actual) | 5                   |
| Total Transactions   | 380                 |
| Unique Transactions  | 76                  |
| Total Hops           | 685                 |
| Total Peers          | 20                  |
| Metrics Records      | 25570               |


## Node Overview

|   Index | Node ID                 |   Tx Count |   Peer Count |   Has Metrics |
|--------:|:------------------------|-----------:|-------------:|--------------:|
|       1 | s6GjKgQTAsJItp4XQs6h... |         76 |            4 |             1 |
|       2 | gcE3AImPUGry/R8J5WuK... |         76 |            4 |             1 |
|       3 | yfvt6s5WsmQXn7S+IyrR... |         76 |            4 |             1 |
|       4 | E7Is6N5o73xKbEIoVXRw... |         76 |            4 |             1 |
|       5 | DnZb4pQPRRFYNUL3DEIG... |         76 |            4 |             1 |


![Transactions per Node](charts/tx_per_node.png)


## Transaction Timing Statistics

![PoW Duration (ms) Distribution](charts/pow_duration_distribution.png)


![Verification Duration (ms) Distribution](charts/verification_duration_distribution.png)


![Completion Duration (ms) Distribution](charts/completion_duration_distribution.png)


![Propagation Delay (ms) Distribution](charts/propagation_delay_distribution.png)


![Avg Propagation per Hop (ms) Distribution](charts/avg_propagation_delay_distribution.png)


| Metric                       |   Count |   Mean |   Median |   P95 |
|:-----------------------------|--------:|-------:|---------:|------:|
| PoW Duration (ms)            |     180 |   1.31 |        1 |     2 |
| Consensus Duration (ms)      |       0 |   0    |        0 |     0 |
| Verification Duration (ms)   |     375 |   4.64 |        4 |     8 |
| Completion Duration (ms)     |     290 |   1.22 |        1 |     2 |
| Propagation Delay (ms)       |      75 |   3.37 |        3 |     5 |
| Avg Propagation per Hop (ms) |      75 |   3.35 |        3 |     5 |


## Consistency Analysis

| Metric                  | Value   |
|:------------------------|:--------|
| Consistency Score       | 100.00% |
| Fully Replicated Tx     | 76      |
| Partially Replicated Tx | 0       |
| Total Unique Tx         | 76      |
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
| 5 nodes      |             76 |


![Replication Distribution](charts/replication_histogram.png)


## Peer Topology

| Metric                 |   Value |
|:-----------------------|--------:|
| Total Peer Connections |      20 |
| Avg Peers per Node     |       4 |
| Isolated Nodes         |       0 |
| Peers in state 2       |      20 |


![Peers per Node](charts/peers_per_node.png)


## Resource Metrics

Total metric records: 25570


![CPU Over Time](charts/cpu_over_time.png)


![RAM Over Time](charts/ram_over_time.png)


### RAM Statistics per Node

|   Node |   Avg RAM Used (MB) |   Max RAM Used (MB) |   Total RAM (MB) |
|-------:|--------------------:|--------------------:|-----------------:|
|      1 |             1219.48 |                2100 |            15661 |
|      2 |             1219.31 |                2139 |            15661 |
|      3 |             1219.14 |                2051 |            15661 |
|      4 |             1218.64 |                1833 |            15661 |
|      5 |             1218.08 |                1539 |            15661 |


## Appendix

| Field           | Value                      |
|:----------------|:---------------------------|
| Generated At    | 2026-05-03T23:42:31.463822 |
| Script Version  | 1.0.0                      |
| Database Path   | /data/db.sqlite3           |
| Run ID          | 1777846139                 |
| Internal Run ID | 28                         |
| Charts Created  | 11                         |

