import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sale } from '../models/Sale';
import { Button, styles } from './Common';
import { formatCLP } from '../utils/currency';

interface SalesListItemProps {
  sale: Sale;
  onMarkAsPaid: (sale: Sale) => void;
  onViewDetail: (sale: Sale) => void;
  onDelete: (id: string) => void;
}

export const SalesListItem = React.memo(function SalesListItem({
  sale,
  onMarkAsPaid,
  onViewDetail,
  onDelete,
}: SalesListItemProps) {
  const dateStr = useMemo(() => new Date(sale.createdAt).toLocaleDateString(), [sale.createdAt]);
  const timeStr = useMemo(() => new Date(sale.createdAt).toLocaleTimeString(), [sale.createdAt]);

  return (
    <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
      <View style={styles.row}>
        <View>
          <Text style={{ fontWeight: '600', fontSize: 14 }}>{dateStr}</Text>
          <Text style={[styles.small, { marginTop: 2 }]}>{timeStr}</Text>
        </View>
        <Text style={{ fontWeight: '700', fontSize: 16, color: '#dc2626' }}>{formatCLP(sale.total)}</Text>
      </View>

      <View style={[styles.row, { marginTop: 8, marginBottom: 8 }]}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View>
            <Text style={styles.small}>Depto</Text>
            <Text style={{ fontWeight: '600' }}>{typeof sale.department === 'number' ? sale.department : '-'}</Text>
          </View>
          <View>
            <Text style={styles.small}>Pago</Text>
            <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{sale.paymentType}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.small}>Items</Text>
          <Text style={{ fontWeight: '600' }}>{sale.items.length}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cobrado" onPress={() => onMarkAsPaid(sale)} iconName="cash-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Detalle" variant="secondary" onPress={() => onViewDetail(sale)} iconName="eye-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Eliminar" variant="danger" onPress={() => onDelete(sale.id)} iconName="trash-outline" />
        </View>
      </View>
    </View>
  );
});
