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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get('https://whitespace-project.onrender.com/api/store-data');
        setStoreData(res.data);

        const uniqueSpvs = [...new Set(res.data.map(row => row.spv))]
          .filter(spv => spv) // Filter out null/undefined values
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
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isLoading]);

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

    // Autofill Region and Distributor if only one value is available
    if (uniqueRegions.length === 1) {
      setRegions(uniqueRegions);
      setSelectedRegion(uniqueRegions[0]);
    } else {
      setRegions(uniqueRegions);
    }

    if (uniqueDistributors.length === 1) {
      setDistributors(uniqueDistributors);
      setSelectedDistributor(uniqueDistributors[0]);
    } else {
      setDistributors(uniqueDistributors);
    }

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
      alert('Location sent successfully!');
    } catch (error) {
      console.error("Error sending location:", error);
      alert('Failed to send location.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg space-y-4 w-full max-w-md">
      {/* Loading Screen Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-white bg-opacity-80 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-medium text-gray-700">Loading, please wait...</p>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-center">Send My Location</h2>

      {/* Dropdowns */}
      <div className="space-y-3">
        {/* SPV - Now using react-select */}
        <div>
          <label className="block text-sm font-medium mb-1">SPV</label>
          <Select
            options={spvs}
            value={selectedSPV}
            onChange={handleSPVChange}
            placeholder="Select SPV"
            isSearchable
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>

        {/* Region - Keeping as native select */}
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

        {/* Distributor - Keeping as native select */}
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

        {/* Store - Now using react-select */}
        <div className={`${selectedDistributor ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block text-sm font-medium mb-1">Store</label>
          <Select
            options={filteredStores}
            value={selectedStore}
            onChange={handleStoreChange}
            placeholder="Select Store"
            isSearchable
            className="react-select-container"
            classNamePrefix="react-select"
            isDisabled={!selectedDistributor}
          />
        </div>
      </div>

      {/* Map */}
      {selectedStore && position && (
        <div className="w-full h-64 rounded-lg overflow-hidden shadow mt-4">
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
        </div>
      )}

      {/* Address Preview */}
      {addressInfo && (
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
      <button
        onClick={sendLocation}
        disabled={!selectedStore || !position || !addressInfo || isLoading}
        className={`w-full p-3 rounded font-semibold transition ${
          selectedStore && position && addressInfo && !isLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Loading...' : 'Send Location'}
      </button>
    </div>
  );
};

export default LocationButton;  