import os
channel = grpc.insecure_channel(os.getenv('CATALOG_ADDR', 'catalog') + ':50051')
stub = CatalogServiceStub(channel)
if __name__ == "__main__":
    serve()
