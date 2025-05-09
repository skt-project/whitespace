import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import Select from 'react-select';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBD-xnQ_jtYDhkOzVbkYtWH1LHT5EBHoOw'; // Replace with your actual key

const LocationButton = () => {
  const [storeData, setStoreData] = useState([]);
  const [regions, setRegions] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [spvs, setSpvs] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [selectedSPV, setSelectedSPV] = useState(null);
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [position, setPosition] = useState(null);
  const [addressInfo, setAddressInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [locationSent, setLocationSent] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get('https://whitespace-project.onrender.com/api/store-data');
        setStoreData(res.data);

        const uniqueSpvs = [...new Set(res.data.map(row => row.spv))]
          .filter(spv => spv)
          .map(spv => ({ value: spv, label: spv }));
        setSpvs(uniqueSpvs);
      } catch (error) {
        console.error("Error fetching store data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isLoading || isMapFullscreen ? 'hidden' : '';
  }, [isLoading, isMapFullscreen]);

  const handleSPVChange = (selectedOption) => {
    setSelectedSPV(selectedOption);
    setSelectedRegion('');
    setSelectedDistributor('');
    setSelectedStore(null);
    setPosition(null);
    setAddressInfo(null);

    const spvValue = selectedOption?.value;
    if (!spvValue) return;

    const filteredBySPV = storeData.filter(row => row.spv === spvValue);
    const uniqueRegions = [...new Set(filteredBySPV.map(row => row.region))];
    const uniqueDistributors = [...new Set(filteredBySPV.map(row => row.distributor))];
    const storeOptions = filteredBySPV.map(store => ({
      value: store.store_id,
      label: `${store.store_id} - ${store.store_name}`,
      ...store
    }));

    setRegions(uniqueRegions);
    setDistributors(uniqueDistributors);

    if (uniqueRegions.length === 1) setSelectedRegion(uniqueRegions[0]);
    if (uniqueDistributors.length === 1) setSelectedDistributor(uniqueDistributors[0]);

    if (storeOptions.length === 1) {
      setFilteredStores(storeOptions);
      setSelectedStore(storeOptions[0]);
      setPosition({
        lat: storeOptions[0].latitude,
        lng: storeOptions[0].longitude
      });
      reverseGeocode(storeOptions[0].latitude, storeOptions[0].longitude).then(setAddressInfo);
    } else {
      setFilteredStores(storeOptions);
    }
  };

  const handleRegionChange = (e) => {
    const region = e.target.value;
    setSelectedRegion(region);
    setSelectedDistributor('');
    setSelectedStore(null);
    setPosition(null);
    setAddressInfo(null);

    const filteredByRegion = storeData.filter(row =>
      row.spv === selectedSPV?.value && row.region === region
    );
    const uniqueDistributors = [...new Set(filteredByRegion.map(row => row.distributor))];
    setDistributors(uniqueDistributors);

    filterStores(region, '', selectedSPV?.value);
  };

  const handleDistributorChange = (e) => {
    const distributor = e.target.value;
    setSelectedDistributor(distributor);
    setSelectedStore(null);
    setPosition(null);
    setAddressInfo(null);

    filterStores(selectedRegion, distributor, selectedSPV?.value);
  };

  const filterStores = (region, distributor, spv) => {
    const filtered = storeData.filter(row =>
      (spv ? row.spv === spv : true) &&
      (region ? row.region === region : true) &&
      (distributor ? row.distributor === distributor : true)
    ).map(store => ({
      value: store.store_id,
      label: `${store.store_id} - ${store.store_name}`,
      ...store
    }));
    setFilteredStores(filtered);
  };

  const handleStoreChange = (selectedOption) => {
    const store = selectedOption;
    setSelectedStore(store);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setPosition(coords);
        const info = await reverseGeocode(coords.lat, coords.lng);
        setAddressInfo(info);
      }, (err) => {
        console.error('Geolocation error:', err);
        alert('Failed to retrieve your location.');
      });
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (!res.data.results.length) throw new Error("No address found");

      const components = res.data.results[1].address_components;

      const getComponent = (typesArray) => {
        for (const type of typesArray) {
          const match = components.find(c => c.types.includes(type));
          if (match) return match.long_name;
        }
        return '';
      };

      return {
        address: res.data.results[1].formatted_address,
        subdistrict: getComponent(['administrative_area_level_4']),
        district: getComponent(['administrative_area_level_3']),
        city: getComponent(['administrative_area_level_2']),
        province: getComponent(['administrative_area_level_1']),
        postcode: getComponent(['postal_code'])
      };
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      return {};
    }
  };

  const sendLocation = async () => {
    if (!selectedStore || !position || !addressInfo) {
      return alert('Missing location or address information.');
    }

    setIsLoading(true);
    try {
      const payload = {
        store_id: selectedStore.store_id,
        store_name: selectedStore.store_name,
        distributor: selectedDistributor,
        region: selectedRegion,
        spv: selectedSPV.value,
        longitude: position.lng,
        latitude: position.lat,
        calendar_date: new Date().toISOString().split('T')[0],
        address: addressInfo.address,
        subdistrict: addressInfo.subdistrict,
        district: addressInfo.district,
        city: addressInfo.city,
        province: addressInfo.province,
        postcode: addressInfo.postcode
      };

      await axios.post('https://whitespace-project.onrender.com/api/location', payload);
      setLocationSent(true);
      setTimeout(() => {
        window.location.reload(); // Refresh the page
      }, 2000);
    } catch (error) {
      console.error("Error sending location:", error);
      alert('Failed to send location.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg space-y-4 w-full max-w-md relative z-10">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white bg-opacity-80 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-medium text-gray-700">Loading, please wait...</p>
          </div>
        </div>
      )}

      {/* Hide form when in fullscreen */}
      {!isMapFullscreen && (
        <>
          <h2 className="text-2xl font-semibold text-center">Store Coordinates Collection</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">SPV</label>
              <Select
                options={spvs}
                value={selectedSPV}
                onChange={handleSPVChange}
                placeholder="Select SPV"
                isSearchable
                classNamePrefix="react-select"
              />
            </div>

            <div className={`${selectedSPV ? '' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select
                value={selectedRegion}
                onChange={handleRegionChange}
                className="w-full p-2 border rounded"
                disabled={!selectedSPV}
              >
                <option value="">Select Region</option>
                {regions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div className={`${selectedRegion ? '' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium mb-1">Distributor</label>
              <select
                value={selectedDistributor}
                onChange={handleDistributorChange}
                className="w-full p-2 border rounded"
                disabled={!selectedRegion}
              >
                <option value="">Select Distributor</option>
                {distributors.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className={`${selectedDistributor ? '' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium mb-1">Store</label>
              <Select
                options={filteredStores}
                value={selectedStore}
                onChange={handleStoreChange}
                placeholder="Select Store"
                isSearchable
                classNamePrefix="react-select"
                isDisabled={!selectedDistributor}
              />
            </div>
          </div>
        </>
      )}

      {/* Map */}
      {selectedStore && position && (
        <>
          <div className={`rounded-lg overflow-hidden shadow ${isMapFullscreen ? 'fixed inset-0 z-50' : 'h-64 mt-4'}`}>
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              <GoogleMap
                center={position}
                zoom={17}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                onClick={(e) => {
                  const newPos = {
                    lat: e.latLng.lat(),
                    lng: e.latLng.lng()
                  };
                  setPosition(newPos);
                  reverseGeocode(newPos.lat, newPos.lng).then(setAddressInfo);
                }}
                options={{
                  fullscreenControl: false,
                  mapTypeControl: false,
                  streetViewControl: false,
                  zoomControl: false,
                  keyboardShortcuts: false,
                  disableDefaultUI: true,
                }}
              >
                <Marker
                  key={`${position.lat}-${position.lng}`}
                  position={position}
                  draggable
                  onDragEnd={(e) => {
                    const newPos = {
                      lat: e.latLng.lat(),
                      lng: e.latLng.lng()
                    };
                    setPosition(newPos);
                    reverseGeocode(newPos.lat, newPos.lng).then(setAddressInfo);
                  }}
                />
              </GoogleMap>
            </LoadScript>

            {/* Close map button in fullscreen */}
            {isMapFullscreen && (
              <button
                onClick={() => setIsMapFullscreen(false)}
                className="absolute top-4 left-8 z-50 flex items-center gap-2 bg-white text-red-600 border border-gray-300 shadow-lg px-4 py-2 rounded-full font-bold text-sm hover:bg-gray-100 hover:scale-105 transition-all duration-200"
              >
                <span className="text-lg">←</span> Close Map
              </button>
            )}
          </div>

          {/* View full map button (when not in fullscreen) */}
          {!isMapFullscreen && (
            <button
              onClick={() => setIsMapFullscreen(true)}
              className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-semibold text-center rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105 hover:bg-blue-700 active:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              📍 View Full Map
            </button>
          )}
        </>
      )}

      {/* Address Info */}
      {!isMapFullscreen && addressInfo && (
        <div className="bg-gray-50 p-3 rounded text-sm shadow">
          <p><strong>Address:</strong> {addressInfo.address}</p>
          <p><strong>Subdistrict:</strong> {addressInfo.subdistrict}</p>
          <p><strong>District:</strong> {addressInfo.district}</p>
          <p><strong>City:</strong> {addressInfo.city}</p>
          <p><strong>Province:</strong> {addressInfo.province}</p>
          <p><strong>Postcode:</strong> {addressInfo.postcode}</p>
        </div>
      )}

      {/* Send Button */}
      {!isMapFullscreen && (
        <button
          onClick={sendLocation}
          disabled={
            !selectedStore || !position || !addressInfo || isLoading || locationSent
          }
          className={`w-full mt-4 py-3 px-4 rounded-2xl font-semibold transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            locationSent
              ? 'bg-green-700 text-white cursor-default'
              : selectedStore && position && addressInfo && !isLoading
              ? 'bg-green-600 text-white hover:bg-green-700 hover:scale-105 focus:ring-green-400'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {locationSent ? '✅ Location Sent!' : isLoading ? 'Loading...' : '📨 Send Location'}
        </button>
      )}
    </div>
  );
};

export default LocationButton;
