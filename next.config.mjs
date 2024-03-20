import MillionLint from '@million/lint';
/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx"],
  output: "standalone",
  images: {
    remotePatterns: [{
      protocol: "https",
      hostname: "du502cbk6jn66.cloudfront.net",
      port: "",
      pathname: "/content/images/**"
    }]
  }
};
export default MillionLint.next({
  rsc: true
})(nextConfig);