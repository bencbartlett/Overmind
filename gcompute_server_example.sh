#!/bin/bash

# Steam key for authentication
STEAM_KEY="Get your key at https://steamcommunity.com/dev/apikey"

# Variables
PROJECT_ID="screeps-rl"

# Machine types, prices as of Feb 2024
# MACHINE_TYPE="e2-medium"  # $0.04/hr, general-purpose, 2 vCPUs, 4 GB memory
MACHINE_TYPE="c2-standard-4"  # $0.17/hr, compute-optimized, 4 vCPUs, 16 GB memory
# MACHINE_TYPE="c2-standard-60"  # $2.51/hr, compute-optimized, 60 vCPUs, 240 GB memory

REGION="us-west1"
ZONE="us-west1-b"
INSTANCE_NAME="screeps-test"

# WIP: flag that can be used to make the instance persistent and shut down after 12 hours if not set true
PERSISTENT=false

# Parse command-line arguments
for arg in "$@"
do
    case $arg in
        --persistent)
        PERSISTENT=true
        shift # Remove --persistent from processing
        ;;
    esac
done

## IF YOU WANT TO USE A STATIC EXTERNAL IP ADDRESS, UNCOMMENT THE FOLLOWING LINES
## Check if a static external IP address is already reserved
#IP_ADDRESS=$(gcloud compute addresses describe $INSTANCE_NAME-ip --project=$PROJECT_ID --region=$REGION --format='get(address)' 2>/dev/null)
#
#if [ -z "$IP_ADDRESS" ]; then
#    echo "Reserving a new static external IP address..."
#    gcloud compute addresses create $INSTANCE_NAME-ip --project=$PROJECT_ID --region=$REGION
#    IP_ADDRESS=$(gcloud compute addresses describe $INSTANCE_NAME-ip --project=$PROJECT_ID --region=$REGION --format='get(address)')
#else
#    echo "Using existing reserved IP Address: $IP_ADDRESS"
#fi

BIN_BASH="#!/bin/bash"
STARTUP_SCRIPT="
# Update and install necessary packages
sudo apt-get update
sudo apt-get install -y curl build-essential libssl-dev

# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
# Source nvm script to make it available in this script session
export NVM_DIR='$HOME/.nvm'
[ -s '$NVM_DIR/nvm.sh' ] && \. '$NVM_DIR/nvm.sh'
[ -s '$NVM_DIR/bash_completion' ] && \. '$NVM_DIR/bash_completion'
# Install Node.js version 16
nvm install 16
nvm use 16

# Set npm to use Python 2.7 for build
sudo apt-get install -y python2
npm config set python /usr/bin/python2

# Install and start Screeps
cd ~ && mkdir 'server' && cd 'server'
npm install 'https://github.com/bencbartlett/screeps' --save
echo '$STEAM_KEY' | npx screeps init
npm install screepsmod-auth

# Overwrite the mods.json file because it doesn't seem to update properly
echo '{
  \"mods\": [
    \"node_modules/screepsmod-auth\"
  ],
  \"bots\": {
    \"simplebot\": \"node_modules/@screeps/simplebot/src\"
  }
}' > mods.json

# npx screeps start
"

SHUTDOWN_COMMAND="sudo shutdown -h +720" # shut down the instance after 12 hours
if [ "$PERSISTENT" = false ]; then
    STARTUP_SCRIPT="$SHUTDOWN_COMMAND\n$STARTUP_SCRIPT"
fi
STARTUP_SCRIPT="$BIN_BASH\n$STARTUP_SCRIPT"

# Create GCE Instance
echo "Creating instance $INSTANCE_NAME in project $PROJECT_ID with machine type $MACHINE_TYPE..."
gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --metadata=startup-script="$STARTUP_SCRIPT"

# Instructions for the user
if [ "$PERSISTENT" = false ]; then
    echo "NOTE: this instance will automatically shut down after 12 hours. To prevent this, restart the instance with the --persistent flag."
else
    echo "NOTE: this instance is set to persist and will not automatically shut down. This could rack up costs if left running!"
fi


# Retrieve and print the external IP address of the instance
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --format='get(networkInterfaces[0].accessConfigs[0].natIP)' --project=$PROJECT_ID --zone=$(gcloud compute instances list --filter="name=($INSTANCE_NAME)" --format="get(zone)" --project=$PROJECT_ID))
echo -e "
\033[31mInstance $INSTANCE_NAME is now running with external IP address: $EXTERNAL_IP.\033[0m
  - To connect: gcloud compute ssh $INSTANCE_NAME --project $PROJECT_ID
  - To stop:    gcloud compute instances stop $INSTANCE_NAME --project $PROJECT_ID
  - To delete:  gcloud compute instances delete $INSTANCE_NAME --project $PROJECT_ID
"

# Wait for a few seconds so ssh can connect
echo "Waiting for a few seconds so SSH can connect..."
sleep 15

# Allow access on ports 21025 and 21026
FIREWALL_RULE_NAME="allow-screeps"
if gcloud compute firewall-rules describe $FIREWALL_RULE_NAME --format="value(name)" 2>/dev/null; then
    echo "Firewall rule $FIREWALL_RULE_NAME already exists."
else
    echo "Firewall rule $FIREWALL_RULE_NAME does not exist. Creating it..."
    gcloud compute firewall-rules create $FIREWALL_RULE_NAME --direction=INGRESS --priority=1000 --network=default --action=ALLOW --rules=tcp:21025,tcp:21026 --source-ranges=0.0.0.0/0 --target-tags=screeps-server
    gcloud compute instances add-tags $INSTANCE_NAME --tags=screeps-server --zone=YOUR_INSTANCE_ZONE
fi

# Connect to the instance via SSH
echo "Attempting to SSH into the instance. This may take a few moments."
gcloud compute ssh $INSTANCE_NAME --project $PROJECT_ID

