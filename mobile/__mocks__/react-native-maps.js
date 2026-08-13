// Manual Jest mock — MapView/Marker are native views with no JS-side
// implementation the test renderer can mount. Rendered as plain RN
// components so screens using them can still be tested for the data/logic
// around the map (markers present, counts, etc.) without a real map.
const React = require('react');
const { View } = require('react-native');

function MapView(props) {
  return React.createElement(View, { testID: 'map-view', ...props }, props.children);
}

function Marker(props) {
  return React.createElement(View, { testID: 'map-marker', ...props });
}

function Polyline(props) {
  return React.createElement(View, { testID: 'map-polyline', ...props });
}

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE: 'google',
};
