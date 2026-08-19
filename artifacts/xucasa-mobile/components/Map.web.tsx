import React from 'react';
import { View, type ViewProps } from 'react-native';

export const MapView = React.forwardRef<View, ViewProps>(
  ({ children, ...props }, ref) => (
    <View ref={ref} {...props}>
      {children}
    </View>
  ),
);

MapView.displayName = 'WebMapView';

export function Marker() {
  return null;
}

export function Callout() {
  return null;
}