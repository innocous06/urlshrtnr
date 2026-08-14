# url.600266.xyz URL Redirector & Shortener
Production-ready URL redirector service built for Oracle Cloud VPS with Cloudflare DNS integration.
## 1. Cloudflare DNS Configuration
Log into your Cloudflare Dashboard for domain `600266.xyz`.
Navigate to DNS -> Records -> Add Record:
- Type: `A`
- Name: `url`
- IPv4 address: `<Your Oracle VPS Public IP>`
- Proxy status: `Proxied` (Orange cloud) or `DNS only` (Grey cloud if using Certbot directly)
- TTL: `Auto`
## 2. Oracle Cloud Firewall / Ingress Rules
Ensure Oracle Cloud Security List permits HTTP (Port 80) and HTTPS (Port 443):
- Virtual Cloud Network (VCN) -> Security Lists -> Ingress Rules
- Add Ingress Rule: Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port Range `80,443`
On your VPS Ubuntu / Debian terminal, open OS firewall ports:
`sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT`
`sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT`
`sudo netfilter-persistent save`
## 3. VPS Deployment Steps
1. Transfer the `url-redirector` folder to your VPS (e.g. to `/var/www/url-redirector` or `~/url-redirector`):
`scp -r url-redirector ubuntu@<your-vps-ip>:~/url-redirector`
2. SSH into your VPS:
`ssh ubuntu@<your-vps-ip>`
3. Navigate to folder and install dependencies:
`cd ~/url-redirector`
`npm install --production`
4. Configure your `.env` file:
`nano .env`
Update `ADMIN_PASSCODE` to your preferred 6-digit PIN (default `600266`).
Update `BASE_URL=https://url.600266.xyz`.
5. Start with PM2 for 24/7 background execution:
`sudo npm install -g pm2`
`pm2 start ecosystem.config.js`
`pm2 save`
`pm2 startup`
## 4. Nginx Reverse Proxy Setup
1. Copy the Nginx configuration:
`sudo cp nginx.conf /etc/nginx/sites-available/url.600266.xyz`
`sudo ln -s /etc/nginx/sites-available/url.600266.xyz /etc/nginx/sites-enabled/`
2. Obtain SSL certificate via Certbot (if not using Cloudflare Flexible):
`sudo certbot --nginx -d url.600266.xyz`
3. Test and reload Nginx:
`sudo nginx -t`
`sudo systemctl reload nginx`
## 5. Passcode & Shortlink Format
- Access `https://url.600266.xyz` and enter your 6-digit passcode to unlock the creation console.
- Standard / Permanent shortlinks generate 5-character alphanumeric codes (`url.600266.xyz/x7K9a`).
- Expiring shortlinks generate 6-character alphanumeric codes (`url.600266.xyz/m9P2q1`).
- Custom aliases can be set (e.g. `url.600266.xyz/resume` or `url.600266.xyz/github`).
- Visitors viewing an interstitial link see the white-black-orange animated redirect screen with your custom note.