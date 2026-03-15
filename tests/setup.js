/**
 * Test setup: provide CONFIG and MOCK before services load
 */
import { vi } from "vitest";

const defaultConfig = {
  twilio: {
    accountSid: "",
    authToken: "",
    verifyServiceSid: "",
    sendCodeUrl: "",
    verifyCodeUrl: "",
  },
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  geolocation: {
    ipGeoUrl: "",
    defaultCenter: { lat: 30.2672, lng: -97.7431 },
    maxDistanceMiles: 50,
  },
};

const cfg = { ...defaultConfig };
cfg.hasTwilio = () =>
  !!(cfg.twilio?.accountSid && cfg.twilio?.authToken) || !!(cfg.twilio?.sendCodeUrl && cfg.twilio?.verifyCodeUrl);
cfg.hasFirebase = () => !!(cfg.firebase?.apiKey && cfg.firebase?.projectId);
cfg.hasIpGeo = () => !!cfg.geolocation?.ipGeoUrl;
global.CONFIG = cfg;

global.MOCK = {
  chatMessages: {
    1: [
      {
        id: "m1",
        author: "Test",
        authorAvatar: "",
        time: "7:15 AM",
        text: "Hello",
        me: false,
      },
    ],
  },
};

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => Object.keys(store).forEach((k) => delete store[k]),
};

// Mock sessionStorage
const sessionStore = {};
global.sessionStorage = {
  getItem: (k) => sessionStore[k] ?? null,
  setItem: (k, v) => {
    sessionStore[k] = String(v);
  },
  removeItem: (k) => {
    delete sessionStore[k];
  },
  clear: () => Object.keys(sessionStore).forEach((k) => delete sessionStore[k]),
};

// Mock navigator.geolocation
global.navigator.geolocation = {
  getCurrentPosition: vi.fn((success, error) => {
    success({ coords: { latitude: 30.2672, longitude: -97.7431, accuracy: 10 } });
  }),
};
