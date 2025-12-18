import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivitiesService } from '../activities.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { User } from '../../admin/entities/user.entity';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(
    private readonly activitiesService: ActivitiesService,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const startTime = Date.now();

    // Skip logging for certain endpoints
    const skipPaths = ['/health', '/metrics', '/favicon.ico', '/activities'];
    const path = request.url?.split('?')[0] || '';
    const method = request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
    
    // Skip GET requests - only log POST, PUT, PATCH, DELETE
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }
    
    if (skipPaths.some(skipPath => path.includes(skipPath))) {
      return next.handle();
    }

    // Extract user information from request
    // Try to get user from request (set by guards) first
    const user = (request as any).user;
    const orgAdmin = (request as any).orgAdmin;
    
    let userType: 'admin' | 'org_admin' | 'user' | 'anonymous' = 'anonymous';
    let userId: string | null = null;
    let orgAdminId: string | null = null;
    let userName: string | null = null;
    let userEmail: string | null = null;

    if (user) {
      // User object is available from guard
      userType = 'user';
      userId = user.id;
      userName = user.fullName || user.name;
      userEmail = user.email;
    } else if (orgAdmin) {
      // Org admin object is available
      userType = 'org_admin';
      orgAdminId = orgAdmin.id;
      userName = orgAdmin.fullName || orgAdmin.name || orgAdmin.email;
      userEmail = orgAdmin.email;
    } else {
      // No user object available - infer from endpoint pattern first
      if (path.includes('/admin/') || path.startsWith('/admin')) {
        userType = 'admin';
      } else if (path.includes('/org/') || path.startsWith('/org/')) {
        userType = 'org_admin';
      } else if (path.includes('/api/mobile/') || path.includes('/mobile/')) {
        userType = 'user';
      } else {
        // Default to anonymous for public endpoints
        userType = 'anonymous';
      }
    }

    // Store expoToken for async lookup in the response handler
    const expoToken = request.headers['x-expo-token'] as string || 
                     request.headers['expo-token'] as string ||
                     (request.body as any)?.expoToken ||
                     null;

    // Extract request details
    const endpoint = path;
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = request.ip || 
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || 
      'unknown';
    const userAgent = (request.headers['user-agent'] as string) || 'unknown';
    
    // Extract request body (limit size to avoid storing huge payloads)
    let requestBody: any = null;
    if (request.body) {
      const bodyStr = JSON.stringify(request.body);
      if (bodyStr.length < 10000) { // Only store if less than 10KB
        requestBody = request.body;
      }
    }

    // Determine action and description from endpoint
    const { action, description, amount } = this.parseEndpoint(endpoint, method, requestBody, user, userName);

    return next.handle().pipe(
      tap({
        next: async (response) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response?.statusCode || response?.status || '200';

          // If user not found yet, try to get from expoToken (for mobile users)
          let finalUserId = userId;
          let finalUserName = userName;
          let finalUserEmail = userEmail;
          let finalUserType = userType;
          
          if (!finalUserId && expoToken) {
            try {
              const userByToken = await this.userRepository.findOne({
                where: { expoToken },
                select: ['id', 'fullName', 'email']
              });
              
              if (userByToken) {
                finalUserId = userByToken.id;
                finalUserName = userByToken.fullName;
                finalUserEmail = userByToken.email;
                finalUserType = 'user';
              }
            } catch (error) {
              this.logger.warn(`Failed to lookup user by expoToken: ${error.message}`);
            }
          }

          // Extract response data (limit size) - use it to enhance description if action is missing
          let responseData: any = null;
          let finalAction = action;
          let finalDescription = description;
          let finalAmount = amount;

          // Handle both wrapped and direct response structures
          let rawResponseData = response?.data || response;
          if (rawResponseData) {
            const responseStr = JSON.stringify(rawResponseData);
            if (responseStr.length < 10000) {
              responseData = rawResponseData;
              // NOTE: Don't extract nested data here - keep the full response structure
              // Different endpoints have different structures, so we need to preserve the original
            }
          }

          // Always enhance for rewards to get property name (even if responseData is null)
          if (endpoint.includes('/rewards/distribute')) {
            const enhanced = await this.parseEndpointFromResponse(endpoint, method, responseData, user, userName, requestBody);
            if (enhanced.action && !finalAction) finalAction = enhanced.action;
            // Always update description for rewards to include property name
            if (enhanced.description) finalDescription = enhanced.description;
            if (enhanced.amount && !finalAmount) finalAmount = enhanced.amount;
          } else if ((endpoint.includes('/investments/invest') || 
                      endpoint.includes('/api/mobile/investments')) && 
                      method === 'POST') {
            // Always enhance for investments to get property name
            this.logger.log(`🔍 Investment endpoint detected: ${endpoint}. responseData: ${responseData ? 'exists' : 'null'}`);
            if (responseData) {
              this.logger.log(`🔍 responseData keys: ${Object.keys(responseData).join(', ')}`);
              if (responseData.investment) {
                this.logger.log(`🔍 Found investment in responseData`);
              }
              if (responseData.property) {
                this.logger.log(`🔍 Found property in responseData: ${responseData.property.title || 'no title'}`);
              }
            }
            const enhanced = await this.parseEndpointFromResponse(endpoint, method, responseData, user, userName, requestBody);
            this.logger.log(`🔍 Enhanced result: action=${enhanced.action}, description=${enhanced.description}, amount=${enhanced.amount}`);
            if (enhanced.action && !finalAction) finalAction = enhanced.action;
            // Always update description for investments - this should have user and property name
            if (enhanced.description) {
              finalDescription = enhanced.description;
              this.logger.log(`✅ Using enhanced description: ${finalDescription}`);
            } else {
              // Fallback: if no description from response, create a basic one
              const userInfo = userName || user?.fullName || user?.name || 'Someone';
              finalDescription = `${userInfo} made an investment`;
              this.logger.warn(`⚠️ No description from enhanced, using fallback: ${finalDescription}`);
            }
            if (enhanced.amount && !finalAmount) finalAmount = enhanced.amount;
          } else if (endpoint.includes('/mobile/auth/register') || endpoint.includes('/api/mobile/auth/register')) {
            // Always enhance for registration to get user info from response
            const enhanced = await this.parseEndpointFromResponse(endpoint, method, responseData, user, userName, requestBody);
            if (enhanced.action && !finalAction) finalAction = enhanced.action;
            if (enhanced.description) finalDescription = enhanced.description; // Always update for registration
            
            // Extract user info from response for registration
            if (responseData?.user) {
              const registeredUser = responseData.user;
              if (!finalUserId && registeredUser.id) finalUserId = registeredUser.id;
              if (!finalUserName && registeredUser.fullName) finalUserName = registeredUser.fullName;
              if (!finalUserEmail && registeredUser.email) finalUserEmail = registeredUser.email;
              if (finalUserType === 'anonymous') finalUserType = 'user';
            }
            
            if (enhanced.amount && !finalAmount) finalAmount = enhanced.amount;
          } else if (endpoint.includes('/mobile/auth/login') || endpoint.includes('/api/mobile/auth/login') || endpoint.includes('/org/auth/login')) {
            // Always enhance for login to get user info from response
            finalAction = 'User Logged In';
            
            // Log for debugging
            this.logger.log(`🔐 Login activity detected for endpoint: ${endpoint}`);
            this.logger.log(`🔐 ResponseData keys: ${responseData ? Object.keys(responseData).join(', ') : 'null'}`);
            
            // Extract user info from response for login
            // Check multiple possible response structures
            let loggedInUser = responseData?.user || responseData?.data?.user;
            let loggedInAdmin = responseData?.admin || responseData?.data?.admin;
            
            if (loggedInUser) {
              this.logger.log(`🔐 Found user in response: ${loggedInUser.fullName || loggedInUser.email}`);
              if (!finalUserId && loggedInUser.id) finalUserId = loggedInUser.id;
              if (!finalUserName && loggedInUser.fullName) finalUserName = loggedInUser.fullName;
              if (!finalUserEmail && loggedInUser.email) finalUserEmail = loggedInUser.email;
              if (finalUserType === 'anonymous') finalUserType = 'user';
              // Set description to show user name
              finalDescription = loggedInUser.fullName || loggedInUser.name || loggedInUser.email || 'User';
            } else if (loggedInAdmin) {
              // For org admin login
              this.logger.log(`🔐 Found admin in response: ${loggedInAdmin.fullName || loggedInAdmin.email}`);
              if (!orgAdminId && loggedInAdmin.id) orgAdminId = loggedInAdmin.id;
              if (!finalUserName && loggedInAdmin.fullName) finalUserName = loggedInAdmin.fullName;
              if (!finalUserEmail && loggedInAdmin.email) finalUserEmail = loggedInAdmin.email;
              if (finalUserType === 'anonymous') {
                finalUserType = 'org_admin';
              }
              // Set description to show admin name
              finalDescription = loggedInAdmin.fullName || loggedInAdmin.name || loggedInAdmin.email || 'ORG Admin';
            } else if (requestBody?.email) {
              // Fallback: use email from request body if response doesn't have user info
              this.logger.log(`🔐 Using email from request body: ${requestBody.email}`);
              finalDescription = requestBody.email;
            }
            
            // If we still don't have a description, use a generic one
            if (!finalDescription) {
              finalDescription = endpoint.includes('/org/auth/login') ? 'ORG Admin' : 'User';
              this.logger.warn(`🔐 No user info found, using fallback: ${finalDescription}`);
            }
            
            this.logger.log(`🔐 Final login activity: action=${finalAction}, description=${finalDescription}, userType=${finalUserType}, userName=${finalUserName}`);
          } else if (responseData && (!finalAction || !finalDescription)) {
            // Enhance action/description from response for other endpoints
            const enhanced = await this.parseEndpointFromResponse(endpoint, method, responseData, user, userName, requestBody);
            if (enhanced.action && !finalAction) finalAction = enhanced.action;
            if (enhanced.description && !finalDescription) finalDescription = enhanced.description;
            if (enhanced.amount && !finalAmount) finalAmount = enhanced.amount;
          }

          // Only log if we have a meaningful action (skip generic POST/PATCH without context)
          if (!finalAction) {
            // Try to create a meaningful action from endpoint
            finalAction = this.createActionFromEndpoint(endpoint, method);
            if (!finalAction) {
              // For login endpoints, always log even if we couldn't extract user info
              if (endpoint.includes('/mobile/auth/login') || endpoint.includes('/api/mobile/auth/login') || endpoint.includes('/org/auth/login')) {
                finalAction = 'User Logged In';
                if (!finalDescription) {
                  finalDescription = endpoint.includes('/org/auth/login') ? 'ORG Admin' : 'User';
                }
              } else {
                // Skip logging if we can't determine a meaningful action
                return;
              }
            }
          }

          // Create activity asynchronously (don't block the response)
          this.activitiesService.createActivity({
            method,
            endpoint,
            userType: finalUserType,
            userId: finalUserId,
            orgAdminId,
            userName: finalUserName,
            userEmail: finalUserEmail,
            statusCode: String(statusCode),
            action: finalAction,
            description: finalDescription || (finalAction ? `${finalAction}` : endpoint),
            amount: finalAmount,
            ipAddress,
            userAgent,
            requestBody,
            responseData,
            responseTime,
          }).then((activity) => {
            this.logger.log(`✅ Activity logged: ${finalAction} - ${finalDescription || 'No description'} - ${finalAmount || 'No amount'}`);
            if (endpoint.includes('/investments/invest')) {
              this.logger.log(`📊 Investment activity - responseData keys: ${responseData ? Object.keys(responseData).join(', ') : 'null'}`);
              if (responseData?.data) {
                this.logger.log(`📊 responseData.data keys: ${Object.keys(responseData.data).join(', ')}`);
              }
            }
            if (endpoint.includes('/mobile/auth/login') || endpoint.includes('/api/mobile/auth/login') || endpoint.includes('/org/auth/login')) {
              this.logger.log(`🔐 Login activity created successfully: ${activity.id}`);
            }
          }).catch((error) => {
            this.logger.error(`Failed to log activity: ${error.message}`, error.stack);
            if (endpoint.includes('/mobile/auth/login') || endpoint.includes('/api/mobile/auth/login') || endpoint.includes('/org/auth/login')) {
              this.logger.error(`🔐 Failed to log login activity for endpoint: ${endpoint}`, error);
            }
          });
        },
        error: async (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error?.status || error?.statusCode || '500';

          this.activitiesService.createActivity({
            method,
            endpoint,
            userType,
            userId,
            orgAdminId,
            userName,
            userEmail,
            statusCode: String(statusCode),
            action,
            description,
            amount,
            ipAddress,
            userAgent,
            requestBody,
            responseTime,
          }).catch((err) => {
            this.logger.error(`Failed to log activity error: ${err.message}`, err.stack);
          });
        },
      }),
    );
  }

  private parseEndpoint(
    endpoint: string,
    method: string,
    requestBody: any,
    user: any = null,
    userName: string | null = null,
  ): { action: string | null; description: string | null; amount: string | null } {
    let action: string | null = null;
    let description: string | null = null;
    let amount: string | null = null;

    // Helper to format user info
    const getUserInfo = () => {
      if (userName) return userName;
      if (user?.fullName) return user.fullName;
      if (user?.name) return user.name;
      if (user?.email) return user.email;
      if (requestBody?.fullName) return requestBody.fullName;
      if (requestBody?.name) return requestBody.name;
      if (requestBody?.email) return requestBody.email;
      return null;
    };

    // Parse based on endpoint patterns
    if (endpoint.includes('/properties')) {
      if (method === 'POST') {
        action = 'Property Created';
        description = requestBody?.title || requestBody?.name || 'New Property';
      } else if (method === 'PATCH' || method === 'PUT') {
        action = 'Property Updated';
        description = requestBody?.title || requestBody?.name || 'Property';
      } else if (method === 'DELETE') {
        action = 'Property Deleted';
        description = 'Property removed';
      }
    } else if (endpoint.includes('/investments')) {
      if (method === 'POST' && endpoint.includes('/invest')) {
        action = 'New Investment';
        // Description will be set in parseEndpointFromResponse with property name
        description = null; // Will be set from response
        // Extract amount from various possible fields
        const amt = requestBody?.amountUSDT || requestBody?.amount || requestBody?.totalAmount;
        if (amt) {
          amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (requestBody?.tokensToBuy && requestBody?.pricePerToken) {
          const calculated = parseFloat(requestBody.tokensToBuy) * parseFloat(requestBody.pricePerToken);
          amount = `$${calculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      } else if (method === 'POST') {
        action = 'Investment Created';
        const userInfo = getUserInfo();
        description = userInfo ? `${userInfo} - Investment` : 'Investment';
        if (requestBody?.amountUSDT || requestBody?.amount) {
          amount = `$${parseFloat(requestBody.amountUSDT || requestBody.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }
    } else if (endpoint.includes('/wallet/deposit')) {
      action = 'Deposit';
      const userInfo = getUserInfo();
      description = userInfo ? `${userInfo} made a deposit` : 'Deposit transaction';
      if (requestBody?.amount || requestBody?.amountUSDT) {
        const amt = requestBody.amount || requestBody.amountUSDT;
        amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else if (endpoint.includes('/wallet/withdraw') || endpoint.includes('/wallet-transactions/withdrawal')) {
      action = 'Withdrawal';
      const userInfo = getUserInfo();
      description = userInfo ? `${userInfo} made a withdrawal` : 'Withdrawal transaction';
      if (requestBody?.amount || requestBody?.amountUSDT) {
        const amt = requestBody.amount || requestBody.amountUSDT;
        amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else if (endpoint.includes('/transactions')) {
      action = 'Transaction';
      const userInfo = getUserInfo();
      const txnType = requestBody?.type || 'transaction';
      description = userInfo ? `${userInfo} - ${txnType}` : txnType;
      if (requestBody?.amountUSDT || requestBody?.amount) {
        const amt = requestBody.amountUSDT || requestBody.amount;
        amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else if (endpoint.includes('/users') || endpoint.includes('/admin/users')) {
      if (method === 'POST') {
        action = 'New User Registered';
        description = requestBody?.fullName || requestBody?.name || requestBody?.email || 'New User';
      } else if (method === 'PATCH' || method === 'PUT') {
        action = 'User Updated';
        const userInfo = getUserInfo();
        description = userInfo || requestBody?.fullName || requestBody?.name || 'User';
      }
    } else if (endpoint.includes('/mobile/auth/register') || endpoint.includes('/api/mobile/auth/register')) {
      // Mobile app user registration
      if (method === 'POST') {
        action = 'New User Registered';
        const userInfo = requestBody?.fullName || requestBody?.name || requestBody?.email || 'New User';
        description = userInfo;
      }
    } else if (endpoint.includes('/rewards')) {
      if (method === 'POST' && endpoint.includes('/distribute')) {
        action = 'Reward Distributed';
        // Property name will be extracted from response data or database lookup
        description = null; // Will be set in parseEndpointFromResponse
        if (requestBody?.totalRoiUSDT || requestBody?.amount) {
          const amt = requestBody.totalRoiUSDT || requestBody.amount;
          amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }
    } else if (endpoint.includes('/kyc/submit')) {
      action = 'KYC Submitted';
      const userInfo = getUserInfo();
      description = userInfo ? `${userInfo} submitted KYC` : 'KYC submission';
    } else if (endpoint.includes('/payment-methods')) {
      action = 'Payment Method Updated';
      const userInfo = getUserInfo();
      description = userInfo ? `${userInfo} updated payment method` : 'Payment method updated';
    }

    return { action, description, amount };
  }

  private async parseEndpointFromResponse(
    endpoint: string,
    method: string,
    responseData: any,
    user: any = null,
    userName: string | null = null,
    requestBody: any = null,
  ): Promise<{ action: string | null; description: string | null; amount: string | null }> {
    let action: string | null = null;
    let description: string | null = null;
    let amount: string | null = null;

    // Helper to get user info
    const getUserInfo = () => {
      if (userName) return userName;
      if (user?.fullName) return user.fullName;
      if (user?.name) return user.name;
      if (user?.email) return user.email;
      return null;
    };

    // Extract meaningful data from response
    if (endpoint.includes('/users') || endpoint.includes('/admin/users') || 
        endpoint.includes('/mobile/auth/register') || endpoint.includes('/api/mobile/auth/register')) {
      if (responseData?.user || responseData?.data) {
        const userData = responseData.user || responseData.data;
        description = userData.fullName || userData.name || userData.email || 'New User';
        // For registration, also set user type and ID from response
        if (endpoint.includes('/mobile/auth/register') || endpoint.includes('/api/mobile/auth/register')) {
          action = 'New User Registered';
        }
      }
    } else if (endpoint.includes('/properties')) {
      if (responseData?.property || responseData?.data) {
        const property = responseData.property || responseData.data;
        description = property.title || 'Property';
      }
    } else if (endpoint.includes('/investments')) {
      // Handle different investment response structures:
      // 1. Regular investments: { success: true, data: { investment, transaction, property, user, ... } }
      //    responseData = { investment, transaction, property, user, ... }
      // 2. Mobile investments: { id, displayCode, property: {...}, investedAmount, ... }
      //    responseData = { id, displayCode, property: {...}, investedAmount, ... }
      let investment: any = null;
      let transaction: any = null;
      let property: any = null;
      let user: any = null;
      
      if (responseData) {
        // Check if it's the regular structure (has investment, transaction, etc.)
        if (responseData.investment) {
          investment = responseData.investment;
          transaction = responseData.transaction;
          property = responseData.property;
          user = responseData.user;
        } 
        // Check if it's the mobile transformed structure (has id, property nested, investedAmount)
        else if (responseData.id && responseData.property) {
          investment = responseData;
          property = responseData.property;
          // Mobile structure doesn't have transaction/user in response, but we can get from requestBody
        }
        // Fallback: if responseData itself looks like an investment
        else if (responseData.id && responseData.propertyId) {
          investment = responseData;
        }
      }
      
      if (investment) {
        // Get user info from response or request
        const userInfo = user?.fullName || user?.name || getUserInfo() || 
                        investment.user?.fullName || investment.user?.name || 
                        transaction?.user?.fullName || transaction?.user?.name;
        
        // Get property name from response or database lookup
        // Mobile structure: investment.property.title
        // Regular structure: property.title or investment.property.title
        let propertyName = property?.title || 
                          investment.property?.title || 
                          investment.propertyName || 
                          transaction?.property?.title || 
                          'Property';
        
        // If property name is still not found, look up from database using propertyId
        if (propertyName === 'Property' && (property?.id || investment.propertyId || investment.property?.id || transaction?.propertyId || requestBody?.propertyId)) {
          try {
            const propertyId = property?.id || 
                              investment.property?.id || 
                              investment.propertyId || 
                              transaction?.propertyId || 
                              requestBody.propertyId;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
            
            const propertyEntity = await this.propertyRepository.findOne({
              where: isUuid ? { id: propertyId } : { displayCode: propertyId },
              select: ['title']
            });
            
            if (propertyEntity) {
              propertyName = propertyEntity.title || propertyId;
            } else {
              propertyName = propertyId; // Use ID as fallback
            }
          } catch (error) {
            this.logger.warn(`Failed to lookup property for investment: ${error.message}`);
            propertyName = property?.id || investment.property?.id || investment.propertyId || transaction?.propertyId || requestBody?.propertyId || 'Property';
          }
        }
        
        // Format: "Abdul Samad invested in Al Nassar Plaza"
        description = userInfo ? `${userInfo} invested in ${propertyName}` : `Investment in ${propertyName}`;
        
        // Get amount - mobile structure uses investedAmount, regular uses amountUSDT
        const amt = investment.investedAmount || 
                   investment.amountUSDT || 
                   investment.amount || 
                   transaction?.amountUSDT || 
                   transaction?.amount;
        if (amt) {
          amount = `$${parseFloat(String(amt)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      } else if (requestBody?.propertyId) {
        // If no response data, look up property from request body
        try {
          const propertyId = requestBody.propertyId;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
          
          const property = await this.propertyRepository.findOne({
            where: isUuid ? { id: propertyId } : { displayCode: propertyId },
            select: ['title']
          });
          
          const userInfo = getUserInfo() || requestBody?.fullName || requestBody?.name;
          const propertyName = property?.title || propertyId;
          description = userInfo ? `${userInfo} invested in ${propertyName}` : `Investment in ${propertyName}`;
        } catch (error) {
          this.logger.warn(`Failed to lookup property for investment: ${error.message}`);
        }
      }
    } else if (endpoint.includes('/transactions')) {
      // Handle different response structures
      let transaction: any = null;
      if (responseData?.transaction) {
        transaction = responseData.transaction;
      } else if (responseData?.data?.transaction) {
        transaction = responseData.data.transaction;
      } else if (responseData?.data && !responseData.data.transaction) {
        transaction = responseData.data;
      }
      
      if (transaction) {
        const userInfo = getUserInfo() || transaction.user?.fullName || transaction.user?.name;
        const txnType = transaction.type || 'transaction';
        description = userInfo ? `${userInfo} - ${txnType}` : txnType;
        if (transaction.amountUSDT || transaction.amount) {
          const amt = transaction.amountUSDT || transaction.amount;
          amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }
    } else if (endpoint.includes('/wallet')) {
      if (responseData?.wallet || responseData?.data || responseData?.transaction) {
        const walletData = responseData.wallet || responseData.data || responseData.transaction;
        const userInfo = getUserInfo() || walletData.user?.fullName || walletData.user?.name;
        if (endpoint.includes('deposit')) {
          description = userInfo ? `${userInfo} made a deposit` : 'Deposit';
        } else if (endpoint.includes('withdraw')) {
          description = userInfo ? `${userInfo} made a withdrawal` : 'Withdrawal';
        }
        if (walletData.amountUSDT || walletData.amount) {
          const amt = walletData.amountUSDT || walletData.amount;
          amount = `$${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      }
    } else if (endpoint.includes('/rewards') && endpoint.includes('/distribute')) {
      // Extract property name from rewards response or look it up from database
      let propertyName = 'Property';
      
      // First, try to get from response data
      if (responseData?.rewards && Array.isArray(responseData.rewards) && responseData.rewards.length > 0) {
        const firstReward = responseData.rewards[0];
        // Try to get property name from reward description (format: "ROI distribution for property {title}")
        if (firstReward?.description) {
          const descMatch = firstReward.description.match(/property\s+([^,\.]+)/i);
          if (descMatch && descMatch[1]) {
            propertyName = descMatch[1].trim();
          }
        }
        // Try to get from nested relations if available
        if (propertyName === 'Property') {
          propertyName = firstReward?.investment?.property?.title || 
                        firstReward?.property?.title ||
                        'Property';
        }
      }
      
      // If still not found, look up property from database using propertyId from request
      if (propertyName === 'Property' && requestBody?.propertyId) {
        try {
          const propertyId = requestBody.propertyId;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
          
          this.logger.debug(`Looking up property: ${propertyId} (isUuid: ${isUuid})`);
          
          const property = await this.propertyRepository.findOne({
            where: isUuid ? { id: propertyId } : { displayCode: propertyId },
            select: ['title']
          });
          
          if (property) {
            propertyName = property.title || propertyId;
            this.logger.debug(`Found property: ${propertyName}`);
          } else {
            this.logger.warn(`Property not found: ${propertyId}`);
            propertyName = propertyId; // Use ID as fallback
          }
        } catch (error) {
          this.logger.error(`Failed to lookup property ${requestBody.propertyId}: ${error.message}`, error.stack);
          propertyName = requestBody.propertyId; // Use ID as fallback
        }
      }
      
      // Always set description with property name for rewards
      if (propertyName && propertyName !== 'Property') {
        description = `Reward distributed for ${propertyName}`;
      } else if (requestBody?.propertyId) {
        description = `Reward distributed for ${requestBody.propertyId}`;
      } else {
        description = `Reward distributed`;
      }
    }

    return { action, description, amount };
  }

  private createActionFromEndpoint(endpoint: string, method: string): string | null {
    // Create meaningful action names from endpoint patterns
    if (endpoint.includes('/wallet/deposit')) return 'Deposit';
    if (endpoint.includes('/wallet/withdraw')) return 'Withdrawal';
    if (endpoint.includes('/investments/invest')) return 'Investment Made';
    if (endpoint.includes('/kyc/submit')) return 'KYC Submitted';
    if (endpoint.includes('/payment-methods')) return 'Payment Method Updated';
    if (endpoint.includes('/admin/users') && method === 'POST') return 'User Created';
    if (endpoint.includes('/admin/users') && (method === 'PATCH' || method === 'PUT')) return 'User Updated';
    if (endpoint.includes('/properties') && method === 'POST') return 'Property Created';
    if (endpoint.includes('/properties') && (method === 'PATCH' || method === 'PUT')) return 'Property Updated';
    if (endpoint.includes('/rewards/distribute')) return 'Reward Distributed';
    
    // Generic fallback - return null to skip logging
    return null;
  }
}

