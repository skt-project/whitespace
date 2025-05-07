import React, { useEffect, useState } from 'react';
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBD-xnQ_jtYDhkOzVbkYtWH1LHT5EBHoOw'; // Replace this with your actual API key

const LocationButton = () => {
  const [storeData, setStoreData] = useState([]);
  const [regions, setRegions] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [spvs, setSpvs] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [selectedSPV, setSelectedSPV] = useState('');
  const [filteredStores, setFilteredStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get('https://whitespace-project.onrender.com/api/store-data');
        setStoreData(res.data);
        
        const uniqueRegions = [...new Set(res.data.map(row => row.region))];
        setRegions(uniqueRegions);
        
        const uniqueDistributors = [...new Set(res.data.map(row => row.distributor))];
        setDistributors(uniqueDistributors);
        
        const uniqueSpvs = [...new Set(res.data.map(row => row.spv))];
        setSpvs(uniqueSpvs);
      } catch (error) {
        console.error("Error fetching store data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleSPVChange = (spv) => {
    setSelectedSPV(spv);
    setSelectedRegion('');
    setSelectedDistributor('');
    setSelectedStore(null);

    const filteredBySPV = storeData.filter(row => row.spv === spv);
    const uniqueRegions = [...new Set(filteredBySPV.map(row => row.region))];
    setRegions(uniqueRegions);

    const uniqueDistributors = [...new Set(filteredBySPV.map(row => row.distributor))];
    setDistributors(uniqueDistributors);

    filterStores('', '', spv);
  };

  const handleRegionChange = (region) => {
    setSelectedRegion(region);
    setSelectedDistributor('');
    setSelectedStore(null);
    
    const filteredByRegion = storeData.filter(row => 
      row.spv === selectedSPV && row.region === region
    );
    const uniqueDistributors = [...new Set(filteredByRegion.map(row => row.distributor))];
    setDistributors(uniqueDistributors);
    
    filterStores(region, '', selectedSPV);
  };

  const handleDistributorChange = (distributor) => {
    setSelectedDistributor(distributor);
    setSelectedStore(null);
    filterStores(selectedRegion, distributor, selectedSPV);
  };

  const filterStores = (region, distributor, spv) => {
    const filtered = storeData.filter(row => 
      (spv ? row.spv === spv : true) &&
      (region ? row.region === region : true) && 
      (distributor ? row.distributor === distributor : true)
    );
    setFilteredStores(filtered);
  };

  const handleStoreChange = (storeId) => {
    const store = filteredStores.find(s => s.store_id === storeId);
    setSelectedStore(store);
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
      throw err;
    }
  };

  const sendLocation = async () => {
    if (!selectedStore) return alert('Please select a store first');
    if (!('geolocation' in navigator)) return alert('Geolocation is not supported');

    setIsLoading(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, (error) => {
          console.error('Geolocation error:', error);
          reject(error);
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const addressInfo = await reverseGeocode(lat, lng);

      const payload = {
        store_id: selectedStore.store_id,
        store_name: selectedStore.store_name,
        distributor: selectedDistributor,
        region: selectedRegion,
        spv: selectedSPV,
        longitude: lng,
        latitude: lat,
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
      alert(error.message.includes('denied') ? 
        'Location access was denied' : 
        'Failed to send location');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg space-y-4 w-full max-w-md transition-all duration-300 hover:shadow-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Send My Location</h2>
      
      <div className="space-y-4">
        {/* SPV Dropdown */}
        <div className="transition-all duration-300 transform hover:scale-[1.01]">
          <label className="block text-sm font-medium text-gray-700 mb-1">SPV</label>
          <select 
            value={selectedSPV} 
            onChange={(e) => handleSPVChange(e.target.value)} 
            className="w-full p-3 border border-gray-300 rounded-lg"
            disabled={isLoading}
          >
            <option value="">Select SPV</option>
            {spvs.map(spv => (
              <option key={spv} value={spv}>{spv}</option>
            ))}
          </select>
        </div>

        {/* Region Dropdown */}
        <div className={`${selectedSPV ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
          <select 
            value={selectedRegion} 
            onChange={(e) => handleRegionChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            disabled={!selectedSPV || isLoading}
          >
            <option value="">Select Region</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        {/* Distributor Dropdown */}
        <div className={`${selectedRegion ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distributor</label>
          <select 
            value={selectedDistributor} 
            onChange={(e) => handleDistributorChange(e.target.value)} 
            className="w-full p-3 border border-gray-300 rounded-lg"
            disabled={!selectedRegion || isLoading}
          >
            <option value="">Select Distributor</option>
            {distributors.map(distributor => (
              <option key={distributor} value={distributor}>{distributor}</option>
            ))}
          </select>
        </div>

        {/* Store Dropdown */}
        <div className={`${selectedDistributor ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
          <select 
            value={selectedStore?.store_id || ''} 
            onChange={(e) => handleStoreChange(e.target.value)} 
            className="w-full p-3 border border-gray-300 rounded-lg"
            disabled={!selectedDistributor || isLoading}
          >
            <option value="">Select Store</option>
            {filteredStores.map(s => (
              <option key={s.store_id} value={s.store_id}>
                {`${s.store_id} - ${s.store_name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button 
        onClick={sendLocation} 
        disabled={!selectedStore || isLoading}
        className={`w-full p-3 rounded-lg font-medium transition-all duration-300 ${
          selectedStore ? 
            'bg-blue-600 hover:bg-blue-700 text-white' : 
            'bg-gray-200 text-gray-500 cursor-not-allowed'
        } ${isLoading ? 'opacity-70' : ''}`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending...
          </span>
        ) : 'Send Location'}
      </button>
    </div>
  );
};

export default LocationButton;