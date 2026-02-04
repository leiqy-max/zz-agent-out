import os
import threading
import time
import logging
from nacos import NacosClient

logger = logging.getLogger(__name__)

class NacosRegistry:
    def __init__(self):
        self.server_addr = os.getenv("NACOS_ADDR", "127.0.0.1:8848")
        self.namespace = os.getenv("NACOS_NAMESPACE", "")
        self.service_name = os.getenv("NACOS_SERVICE_NAME", "ops-agent-biz")
        self.group_name = os.getenv("NACOS_GROUP", "DEFAULT_GROUP")
        self.ip = os.getenv("HOST_IP", "127.0.0.1")
        self.port = int(os.getenv("PORT", "8000"))
        self.client = None
        self.heartbeat_thread = None
        self.running = False

    def start(self):
        if not os.getenv("NACOS_ADDR"):
            logger.info("NACOS_ADDR not set, skipping Nacos registration.")
            return

        try:
            self.client = NacosClient(self.server_addr, namespace=self.namespace)
            self.register()
            self.running = True
            self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop)
            self.heartbeat_thread.daemon = True
            self.heartbeat_thread.start()
            logger.info(f"Successfully registered to Nacos: {self.service_name} at {self.ip}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to register to Nacos: {e}")

    def register(self):
        if self.client:
            self.client.add_naming_instance(
                self.service_name,
                self.ip,
                self.port,
                group_name=self.group_name
            )

    def _heartbeat_loop(self):
        while self.running:
            try:
                # Nacos Python SDK 0.1.12 usually handles heartbeat automatically if client is alive,
                # but sending a registration periodically ensures liveness in some versions.
                self.register()
                time.sleep(5)
            except Exception as e:
                logger.error(f"Nacos heartbeat error: {e}")
                time.sleep(10)

    def stop(self):
        self.running = False
        if self.client:
            try:
                self.client.remove_naming_instance(
                    self.service_name,
                    self.ip,
                    self.port,
                    group_name=self.group_name
                )
                logger.info("Deregistered from Nacos.")
            except Exception as e:
                logger.error(f"Error deregistering from Nacos: {e}")
