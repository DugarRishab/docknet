import React, { useState, useMemo } from 'react';
import { useTransactionHops, useCompareTransactions, TransactionHops } from '../hooks/useTangleData';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { Clock, GitCompare, Route, ArrowRight, X, Check } from 'lucide-react';

interface HopTimelineProps {
  hopsData: TransactionHops;
  color: string;
  isComparison?: boolean;
}

function HopTimeline({ hopsData, color, isComparison = false }: HopTimelineProps) {
  if (!hopsData?.hops?.length) return null;

  const startTime = hopsData.firstHop;
  const endTime = hopsData.lastHop;
  const totalDuration = endTime - startTime;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {hopsData.totalHops} hops • {totalDuration.toLocaleString()}ms total
        </span>
        <span className="text-muted-foreground">
          Avg: {hopsData.avgPropagationDelay?.toLocaleString()}ms/hop
        </span>
      </div>

      <div className="relative">
        {/* Timeline bar */}
        <div className="h-8 bg-secondary/50 rounded-md relative overflow-hidden">
          {hopsData.hops.map((hop, index) => {
            const position = totalDuration > 0 
              ? ((hop.timestamp - startTime) / totalDuration) * 100 
              : 0;
            const isLast = index === hopsData.hops.length - 1;
            
            return (
              <div
                key={`${hop.nodeId}-${index}`}
                className="absolute top-0 bottom-0 w-1 rounded-full transition-all hover:w-2"
                style={{
                  left: `${position}%`,
                  backgroundColor: color,
                  opacity: isLast ? 1 : 0.7 + (index / hopsData.hops.length) * 0.3,
                }}
                title={`${hop.nodeId} at ${new Date(hop.timestamp).toLocaleTimeString()}`}
                aria-label={`${hop.nodeId} at ${new Date(hop.timestamp).toLocaleTimeString()}`}
              />
            );
          })}
        </div>

        {/* Node labels */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{hopsData.hops[0]?.nodeId}</span>
          <span>→</span>
          <span>{hopsData.hops[hopsData.hops.length - 1]?.nodeId}</span>
        </div>
      </div>

      {/* Hop details table */}
      <div className="mt-4 border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Hop</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Node</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Delay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hopsData.hops.map((hop, index) => (
              <tr key={index} className="hover:bg-secondary/30">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-medium">{hop.nodeId}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(hop.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-3 py-2">
                  {hop.relativeDelay > 0 ? (
                    <span className="text-amber-500">+{hop.relativeDelay}ms</span>
                  ) : (
                    <span className="text-emerald-500">origin</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HopHistoryView() {
  const { selectedTransaction, selectedRunId } = useTelemetryStore();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [inputTxId, setInputTxId] = useState('');

  // Fetch hops for selected transaction
  const selectedTxId = selectedTransaction?.data?.transaction_id || null;
  const { data: hopsData, isLoading: hopsLoading } = useTransactionHops(selectedTxId, selectedRunId);

  // Fetch comparison data
  const { data: comparisonData, isLoading: compareLoading } = useCompareTransactions(compareIds, selectedRunId);

  const addToComparison = () => {
    if (inputTxId && !compareIds.includes(inputTxId) && compareIds.length < 4) {
      setCompareIds([...compareIds, inputTxId]);
      setInputTxId('');
    }
  };

  const removeFromComparison = (id: string) => {
    setCompareIds(compareIds.filter((i) => i !== id));
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Route className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-semibold">Transaction Hop History</h2>
      </div>

      {/* Selected Transaction */}
      {selectedTransaction ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium">{selectedTransaction.data.transaction_id}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedTransaction.data.sender} → {selectedTransaction.data.receiver}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{selectedTransaction.data.amount}</p>
              <p className="text-sm text-muted-foreground">{selectedTransaction.data.unit || 'units'}</p>
            </div>
          </div>

          {hopsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading hop data...</div>
          ) : hopsData ? (
            <HopTimeline hopsData={hopsData} color="#3b82f6" />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hop data available for this transaction
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Select a transaction from the Tangle view to see its hop history</p>
        </div>
      )}

      {/* Comparison Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium">Compare Transactions</h3>
        </div>

        {/* Add to comparison */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter transaction ID to compare..."
            value={inputTxId}
            onChange={(e) => setInputTxId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addToComparison()}
            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={addToComparison}
            disabled={compareIds.length >= 4}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Selected comparisons */}
        {compareIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {compareIds.map((id, index) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${colors[index]}20`, color: colors[index] }}
              >
                {id.slice(0, 16)}...
                <button
                  onClick={() => removeFromComparison(id)}
                  aria-label={`Remove ${id.slice(0, 12)} from comparison`}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Comparison results */}
        {compareIds.length >= 2 ? (
          compareLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading comparison...</div>
          ) : comparisonData ? (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Common Nodes</p>
                  <p className="text-2xl font-semibold">{comparisonData.comparison.commonNodes.length}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Avg Hops</p>
                  <p className="text-2xl font-semibold">
                    {comparisonData.comparison.averageHops.toFixed(1)}
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Fastest</p>
                  <p className="text-sm font-medium text-emerald-500 truncate">
                    {comparisonData.comparison.fastestTransaction?.slice(0, 12)}...
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Slowest</p>
                  <p className="text-sm font-medium text-amber-500 truncate">
                    {comparisonData.comparison.slowestTransaction?.slice(0, 12)}...
                  </p>
                </div>
              </div>

              {/* Side-by-side timelines */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Propagation Timelines</h4>
                {comparisonData.transactions.map((tx, index) => (
                  <div key={tx.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="font-medium">{tx.id.slice(0, 20)}...</span>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {tx.hops.length} hops
                      </span>
                    </div>
                    <HopTimeline
                      hopsData={{
                        transactionId: tx.id,
                        hops: tx.hops.map((h, i) => ({
                          timestamp: h.timestamp,
                          nodeId: h.nodeId || h.uid,
                          relativeDelay: h.relativeDelay || 0,
                        })),
                        totalHops: tx.hops.length,
                        propagationDelay: tx.propagationDelay,
                        avgPropagationDelay: tx.avgPropagationDelay,
                        firstHop: tx.hops[0]?.timestamp,
                        lastHop: tx.hops[tx.hops.length - 1]?.timestamp,
                      }}
                      color={colors[index % colors.length]}
                      isComparison
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Add at least 2 transaction IDs to compare their hop histories
          </p>
        )}
      </div>
    </div>
  );
}

export default HopHistoryView;
